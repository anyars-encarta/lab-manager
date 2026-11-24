import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { auth } from "./auth.js";
import { db } from "./db";
import {
  facilities,
  investigations,
  labOrders,
  laboratoryProfiles,
  nhiaClaims,
  orderItems,
  parameters,
  patients,
  payments,
  parameterReferenceRanges,
  resultEntries,
  users,
} from "./db/schema";
import { requireAuth, requireRole } from "./middleware";

export const api = Router();
api.use(requireAuth);

const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: (error?: unknown) => void) => {
    Promise.resolve(handler(req, res)).catch(next);
  };

const numberValue = (value: unknown) => Number(value ?? 0);
const investigationCharge = (item: typeof investigations.$inferSelect) =>
  item.covered
    ? numberValue(item.topUp)
    : numberValue(item.uncoveredTariff);
const calendarAge = (birthDate: Date, at: Date = new Date()) => {
  const today = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const birth = new Date(Date.UTC(birthDate.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate()));
  if (today < birth) return 0;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
  ) age -= 1;
  return Math.max(0, age);
};
const prefixNumber = (prefix: string) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
};

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = 10_000,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const readLimitedImage = async (url: string, maxBytes = 5 * 1024 * 1024) => {
  const response = await fetchWithTimeout(url, { redirect: "manual" });
  if (!response.ok || response.status >= 300 && response.status < 400) {
    throw new Error("Logo URL returned an invalid response");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) {
    throw new Error("Logo exceeds the size limit");
  }
  if (!response.body) throw new Error("Logo response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Logo exceeds the size limit");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return Buffer.from(result);
};

api.get("/me", (req, res) => res.json({ user: req.appUser }));

api.get("/users", requireRole("admin"), asyncRoute(async (_req, res) => {
  res.json(await db.select().from(users).orderBy(asc(users.name)));
}));

api.post("/users", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(8),
    role: z.enum(["admin", "frontdesk", "account", "technician", "doctor"]),
  }).parse(req.body);

  const created = await auth.api.signUpEmail({
    body: { name: body.name, email: body.email, password: body.password },
  });
  await db.update(users).set({ role: body.role }).where(eq(users.id, created.user.id));
  const user = await db.query.users.findFirst({ where: eq(users.id, created.user.id) });
  res.status(201).json(user);
}));

api.patch("/users/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    role: z.enum(["admin", "frontdesk", "account", "technician", "doctor"]).optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  const id = String(req.params.id);
  const [updated] = await db.update(users).set(body).where(eq(users.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "User not found" });
  res.json(updated);
}));

api.get("/facilities", asyncRoute(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const hasPagination = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.search !== undefined;
  if (!hasPagination) {
    res.json(await db.select().from(facilities).orderBy(asc(facilities.name)));
    return;
  }
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));
  const offset = (page - 1) * pageSize;
  const where = search
    ? or(
        ilike(facilities.name, `%${search}%`),
        ilike(facilities.code, `%${search}%`),
        ilike(facilities.phone, `%${search}%`),
        ilike(facilities.nhiaFacilityCode, `%${search}%`),
      )
    : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(facilities).where(where).orderBy(asc(facilities.name)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(facilities).where(where),
  ]);
  res.json({ data: rows, page, pageSize, total: Number(countRows[0]?.count || 0) });
}));

api.post("/facilities", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    code: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.union([z.email(), z.literal("")]).optional(),
    nhiaFacilityCode: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const normalizedBody = {
    ...body,
    code: body.code?.trim() || null,
  };
  const [created] = await db.insert(facilities).values(normalizedBody).returning();
  res.status(201).json(created);
}));

api.patch("/facilities/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).optional(),
    code: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.union([z.email(), z.literal("")]).nullable().optional(),
    nhiaFacilityCode: z.string().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const id = String(req.params.id);
  const [updated] = await db.update(facilities).set(body).where(eq(facilities.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Facility not found" });
  res.json(updated);
}));

api.get("/laboratory-profile", asyncRoute(async (_req, res) => {
  const profile = (await db.select().from(laboratoryProfiles).limit(1))[0];
  res.json(profile || null);
}));

api.post("/laboratory-profile/logo", requireRole("admin"), asyncRoute(async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(503).json({ error: "Cloudinary is not configured" });
  }

  const body = z.object({
    dataUrl: z.string(),
    fileName: z.string().optional(),
  }).parse(req.body);
  const match = body.dataUrl.match(/^data:(image\/(?:png|jpeg));base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "Invalid image data" });

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Logo must be 5 MB or smaller" });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "lab-manager/laboratory-logos";
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const uploadUrl = process.env.CLOUDINARY_UPLOAD_URL?.trim()
    || `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const uploadData = new FormData();
  uploadData.append("file", new Blob([buffer], { type: mimeType }), body.fileName || "laboratory-logo");
  uploadData.append("api_key", apiKey);
  uploadData.append("timestamp", String(timestamp));
  uploadData.append("signature", signature);
  uploadData.append("folder", folder);

  const uploadResponse = await fetchWithTimeout(uploadUrl, { method: "POST", body: uploadData });
  const uploaded = await uploadResponse.json().catch(() => null) as {
    secure_url?: string;
    error?: { message?: string };
  } | null;
  if (!uploadResponse.ok || !uploaded?.secure_url) {
    return res.status(502).json({ error: uploaded?.error?.message || "Unable to upload logo" });
  }

  res.json({ secureUrl: uploaded.secure_url });
}));

api.put("/laboratory-profile", requireRole("admin"), asyncRoute(async (req, res) => {
  let uploadHost: string | null = null;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const effectiveUploadUrl = process.env.CLOUDINARY_UPLOAD_URL?.trim()
    || (cloudName ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload` : "");
  try {
    const parsed = new URL(effectiveUploadUrl);
    if (parsed.protocol === "https:") uploadHost = parsed.host.toLowerCase();
  } catch {
    uploadHost = null;
  }
  const logoUrlSchema = z.union([
    z.literal(""),
    z.literal(null),
    z.string().refine((value) => {
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || uploadHost === null) return false;
        const allowedHosts = new Set([uploadHost]);
        if (uploadHost.startsWith("api.")) {
          allowedHosts.add(uploadHost.replace(/^api\./, "res."));
        }
        return allowedHosts.has(url.host.toLowerCase());
      } catch {
        return false;
      }
    }, "Logo URL must be an HTTPS URL hosted by the configured Cloudinary upload host"),
  ]).optional();
  const body = z.object({
    name: z.string().min(2),
    logoUrl: logoUrlSchema,
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.union([z.email(), z.literal("")]).nullable().optional(),
    slogan: z.string().nullable().optional(),
    currency: z.string().min(3).max(10).optional(),
  }).parse(req.body);
  const values = {
    name: body.name,
    logoUrl: body.logoUrl || null,
    address: body.address || null,
    phone: body.phone || null,
    email: body.email || null,
    slogan: body.slogan || null,
    currency: body.currency || "GHS",
  };
  const existing = (await db.select().from(laboratoryProfiles).limit(1))[0];
  const [saved] = existing
    ? await db.update(laboratoryProfiles).set(values).where(eq(laboratoryProfiles.id, existing.id)).returning()
    : await db.insert(laboratoryProfiles).values(values).returning();
  res.json(saved);
}));

api.get("/investigations", asyncRoute(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));
  const offset = (page - 1) * pageSize;
  const where = and(
    req.query.facilityId ? eq(investigations.facilityId, String(req.query.facilityId)) : undefined,
    search ? or(
      ilike(investigations.name, `%${search}%`),
      ilike(investigations.gdrgCode, `%${search}%`),
      ilike(investigations.specimenType, `%${search}%`),
    ) : undefined,
  );
  const [rows, countRows] = await Promise.all([
    db.select().from(investigations)
      .where(where)
      .orderBy(asc(investigations.name))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(investigations).where(where),
  ]);
  res.json({
    data: rows,
    page,
    pageSize,
    total: Number(countRows[0]?.count || 0),
  });
}));

api.post("/investigations", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    gdrgCode: z.string().trim().max(50).optional(),
    name: z.string().min(2),
    specimenType: z.string().trim().optional(),
    coveredTariff: z.coerce.number().nonnegative().optional(),
    uncoveredTariff: z.coerce.number().nonnegative().optional(),
    topUp: z.coerce.number().nonnegative().optional(),
    covered: z.boolean().optional(),
  }).parse(req.body);
  const facility = (await db.select().from(facilities).orderBy(asc(facilities.name)).limit(1))[0];
  if (!facility) return res.status(400).json({ error: "At least one facility is required" });
  const [created] = await db.insert(investigations).values({
    facilityId: facility.id,
    code: body.gdrgCode || `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    gdrgCode: body.gdrgCode,
    name: body.name,
    specimenType: body.specimenType,
    coveredTariff: (body.coveredTariff ?? 0).toFixed(2),
    uncoveredTariff: (body.uncoveredTariff ?? 0).toFixed(2),
    topUp: (body.topUp ?? 0).toFixed(2),
    price: (body.topUp ?? 0).toFixed(2),
    category: "investigation",
    covered: body.covered ?? true,
  }).returning();
  res.status(201).json(created);
}));

api.patch("/investigations/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    gdrgCode: z.string().trim().max(50).nullable().optional(),
    name: z.string().min(2).optional(),
    specimenType: z.string().optional(),
    coveredTariff: z.coerce.number().nonnegative().optional(),
    uncoveredTariff: z.coerce.number().nonnegative().optional(),
    topUp: z.coerce.number().nonnegative().optional(),
    active: z.boolean().optional(),
    covered: z.boolean().optional(),
  }).parse(req.body);
  const id = String(req.params.id);
  const values = {
    gdrgCode: body.gdrgCode,
    name: body.name,
    specimenType: body.specimenType,
    active: body.active,
    covered: body.covered,
    coveredTariff: body.coveredTariff?.toFixed(2),
    uncoveredTariff: body.uncoveredTariff?.toFixed(2),
    topUp: body.topUp?.toFixed(2),
  };
  if (body.coveredTariff != null || body.topUp != null) {
    const existing = await db.query.investigations.findFirst({ where: eq(investigations.id, id) });
    const topUp = body.topUp ?? numberValue(existing?.topUp);
    Object.assign(values, { price: topUp.toFixed(2) });
  }
  const [updated] = await db.update(investigations).set(values).where(eq(investigations.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Investigation not found" });
  res.json(updated);
}));

api.get("/investigations/:id/parameters", asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  res.json(await db.select().from(parameters).where(eq(parameters.investigationId, id)).orderBy(asc(parameters.sortOrder)));
}));

api.post("/investigations/:id/parameters", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    unit: z.string().nullable().optional(),
    referenceRange: z.string().nullable().optional(),
    referenceLow: z.union([z.null(), z.coerce.number()]).optional(),
    referenceHigh: z.union([z.null(), z.coerce.number()]).optional(),
    dataType: z.enum(["text", "number", "boolean"]).default("text"),
    decimalPlaces: z.number().int().nonnegative().default(0),
    sortOrder: z.number().int().nonnegative().default(0),
    active: z.boolean().optional(),
  }).parse(req.body);
  if (body.referenceLow != null && body.referenceHigh != null && body.referenceLow > body.referenceHigh) {
    return res.status(400).json({ error: "Reference low cannot exceed reference high" });
  }
  const [created] = await db.insert(parameters).values({
    ...body,
    referenceLow: body.referenceLow == null ? null : body.referenceLow.toString(),
    referenceHigh: body.referenceHigh == null ? null : body.referenceHigh.toString(),
    investigationId: String(req.params.id),
    active: body.active ?? true,
  }).returning();
  res.status(201).json(created);
}));

api.patch("/parameters/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    unit: z.string().nullable().optional(),
    referenceRange: z.string().nullable().optional(),
    referenceLow: z.union([z.null(), z.coerce.number()]).optional(),
    referenceHigh: z.union([z.null(), z.coerce.number()]).optional(),
    dataType: z.enum(["text", "number", "boolean"]).optional(),
    decimalPlaces: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  const existing = await db.query.parameters.findFirst({ where: eq(parameters.id, String(req.params.id)) });
  if (!existing) return res.status(404).json({ error: "Parameter not found" });
  const effectiveLow = body.referenceLow === undefined ? existing.referenceLow : body.referenceLow?.toString() ?? null;
  const effectiveHigh = body.referenceHigh === undefined ? existing.referenceHigh : body.referenceHigh?.toString() ?? null;
  if (effectiveLow != null && effectiveHigh != null && Number(effectiveLow) > Number(effectiveHigh)) {
    return res.status(400).json({ error: "Reference low cannot exceed reference high" });
  }
  const values = {
    ...body,
    referenceLow: body.referenceLow === undefined ? undefined : body.referenceLow?.toString() ?? null,
    referenceHigh: body.referenceHigh === undefined ? undefined : body.referenceHigh?.toString() ?? null,
  };
  const [updated] = await db.update(parameters).set(values).where(eq(parameters.id, String(req.params.id))).returning();
  if (!updated) return res.status(404).json({ error: "Parameter not found" });
  res.json(updated);
}));

api.get("/parameters/:id/reference-ranges", asyncRoute(async (req, res) => {
  res.json(await db.select().from(parameterReferenceRanges)
    .where(eq(parameterReferenceRanges.parameterId, String(req.params.id)))
    .orderBy(asc(parameterReferenceRanges.sortOrder)));
}));

api.post("/parameters/:id/reference-ranges", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    gender: z.enum(["all", "male", "female", "other"]).default("all"),
    ageMin: z.coerce.number().int().nonnegative().default(0),
    ageMax: z.coerce.number().int().nonnegative().nullable().optional(),
    referenceLow: z.union([z.null(), z.coerce.number()]).optional(),
    referenceHigh: z.union([z.null(), z.coerce.number()]).optional(),
    referenceRange: z.string().nullable().optional(),
    sortOrder: z.coerce.number().int().nonnegative().default(0),
  }).parse(req.body);
  if (body.ageMax !== null && body.ageMax !== undefined && body.ageMax < body.ageMin) {
    return res.status(400).json({ error: "Maximum age must be greater than or equal to minimum age" });
  }
  if (body.referenceLow !== null && body.referenceHigh !== null &&
      body.referenceLow !== undefined && body.referenceHigh !== undefined &&
      body.referenceLow > body.referenceHigh) {
    return res.status(400).json({ error: "Reference low value cannot exceed reference high value" });
  }
  const parameterId = String(req.params.id);
  const transactionResult = await db.transaction(async (tx): Promise<"overlap" | Array<typeof parameterReferenceRanges.$inferSelect>> => {
    await tx.execute(sql`select "id" from "parameters" where "id" = ${parameterId} for update`);
    const ranges = await tx.select().from(parameterReferenceRanges)
      .where(eq(parameterReferenceRanges.parameterId, parameterId));
    const ageOverlaps = (leftMin: number, leftMax: number | null, rightMin: number, rightMax: number | null) =>
      leftMin <= (rightMax ?? Infinity) && rightMin <= (leftMax ?? Infinity);
    const genderOverlaps = (left: string, right: string) => left === "all" || right === "all" || left === right;
    const ambiguous = ranges.find((range) =>
      range.sortOrder === body.sortOrder &&
      genderOverlaps(range.gender, body.gender) &&
      ageOverlaps(range.ageMin, range.ageMax, body.ageMin, body.ageMax ?? null)
    );
    if (ambiguous) return "overlap";
    return tx.insert(parameterReferenceRanges).values({
      parameterId,
      gender: body.gender,
      ageMin: body.ageMin,
      ageMax: body.ageMax,
      referenceLow: body.referenceLow?.toString(),
      referenceHigh: body.referenceHigh?.toString(),
      referenceRange: body.referenceRange,
      sortOrder: body.sortOrder,
    }).returning();
  });
  if (transactionResult === "overlap") {
    return res.status(409).json({ error: "Overlapping reference profile has the same priority" });
  }
  const [created] = transactionResult;
  res.status(201).json(created);
}));

api.patch("/parameter-reference-ranges/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    gender: z.enum(["all", "male", "female", "other"]).optional(),
    ageMin: z.coerce.number().int().nonnegative().optional(),
    ageMax: z.coerce.number().int().nonnegative().nullable().optional(),
    referenceLow: z.union([z.null(), z.coerce.number()]).optional(),
    referenceHigh: z.union([z.null(), z.coerce.number()]).optional(),
    referenceRange: z.string().nullable().optional(),
    sortOrder: z.coerce.number().int().nonnegative().optional(),
  }).parse(req.body);
  const values = {
    ...body,
    referenceLow: body.referenceLow === undefined ? undefined : body.referenceLow?.toString() ?? null,
    referenceHigh: body.referenceHigh === undefined ? undefined : body.referenceHigh?.toString() ?? null,
  };
  const transactionResult = await db.transaction(async (tx): Promise<"not-found" | "invalid-age" | "invalid-bounds" | "overlap" | Array<typeof parameterReferenceRanges.$inferSelect>> => {
    await tx.execute(sql`select "id" from "parameter_reference_ranges" where "id" = ${String(req.params.id)} for update`);
    const existing = await tx.query.parameterReferenceRanges.findFirst({
      where: eq(parameterReferenceRanges.id, String(req.params.id)),
    });
    if (!existing) return "not-found";
    const effective = {
      gender: body.gender ?? existing.gender,
      ageMin: body.ageMin ?? existing.ageMin,
      ageMax: body.ageMax === undefined ? existing.ageMax : body.ageMax,
      referenceLow: body.referenceLow === undefined ? existing.referenceLow : body.referenceLow,
      referenceHigh: body.referenceHigh === undefined ? existing.referenceHigh : body.referenceHigh,
      sortOrder: body.sortOrder ?? existing.sortOrder,
    };
    if (effective.ageMax !== null && effective.ageMax < effective.ageMin) {
      return "invalid-age";
    }
    if (effective.referenceLow != null && effective.referenceHigh != null &&
        Number(effective.referenceLow) > Number(effective.referenceHigh)) {
      return "invalid-bounds";
    }
    await tx.execute(sql`select "id" from "parameters" where "id" = ${existing.parameterId} for update`);
    const ranges = await tx.select().from(parameterReferenceRanges)
      .where(eq(parameterReferenceRanges.parameterId, existing.parameterId));
    const ageOverlaps = (leftMin: number, leftMax: number | null, rightMin: number, rightMax: number | null) =>
      leftMin <= (rightMax ?? Infinity) && rightMin <= (leftMax ?? Infinity);
    const genderOverlaps = (left: string, right: string) => left === "all" || right === "all" || left === right;
    const ambiguous = ranges.find((range) =>
      range.id !== existing.id &&
      range.sortOrder === effective.sortOrder &&
      genderOverlaps(range.gender, effective.gender) &&
      ageOverlaps(range.ageMin, range.ageMax, effective.ageMin, effective.ageMax)
    );
    if (ambiguous) return "overlap";
    return tx.update(parameterReferenceRanges).set(values)
      .where(eq(parameterReferenceRanges.id, String(req.params.id))).returning();
  });
  if (transactionResult === "overlap") {
    return res.status(409).json({ error: "Overlapping reference profile has the same priority" });
  }
  const [updated] = transactionResult;
  if (!updated) return res.status(404).json({ error: "Reference range not found" });
  res.json(updated);
}));

api.delete("/parameter-reference-ranges/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const [deleted] = await db.delete(parameterReferenceRanges)
    .where(eq(parameterReferenceRanges.id, String(req.params.id))).returning();
  if (!deleted) return res.status(404).json({ error: "Reference range not found" });
  res.status(204).send();
}));

api.get("/patients", asyncRoute(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const page = Math.max(1, Number(req.query.page || 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));
  const offset = (page - 1) * pageSize;
  const where = search
    ? or(
        ilike(sql<string>`concat(${patients.firstName}, ' ', ${patients.lastName})`, `%${search}%`),
        ilike(patients.firstName, `%${search}%`),
        ilike(patients.lastName, `%${search}%`),
        ilike(patients.patientNumber, `%${search}%`),
        ilike(patients.nhisNumber, `%${search}%`),
        ilike(patients.phone, `%${search}%`),
      )
    : undefined;
  const [rows, countRows] = await Promise.all([
    db.select().from(patients).where(where).orderBy(desc(patients.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(patients).where(where),
  ]);
  if (req.query.page || req.query.pageSize || req.query.search) {
    res.json({ data: rows, page, pageSize, total: Number(countRows[0]?.count || 0) });
  } else {
    res.json(rows);
  }
}));

api.post("/patients", requireRole("admin", "frontdesk"), asyncRoute(async (req, res) => {
  const body = z.object({
    facilityId: z.uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.iso.datetime().optional(),
    gender: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    address: z.string().optional(),
    nhisNumber: z.string().optional(),
    nhisStatus: z.string().optional(),
  }).parse(req.body);
  const [created] = await db.insert(patients).values({
    ...body,
    patientNumber: prefixNumber("PAT"),
    dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
  }).returning();
  res.status(201).json(created);
}));

api.post("/patients/register-request", requireRole("admin", "frontdesk"), asyncRoute(async (req, res) => {
  const body = z.object({
    facilityId: z.uuid(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    address: z.string().optional(),
    nhisNumber: z.string().optional(),
    nhisStatus: z.string().optional(),
    clinicianName: z.string().optional(),
    notes: z.string().optional(),
    investigationIds: z.array(z.uuid()).min(1),
  }).parse(req.body);

  const uniqueInvestigationIds = [...new Set(body.investigationIds)];
  const selected = await db.select().from(investigations).where(sql`${investigations.id} in ${uniqueInvestigationIds}`);
  if (selected.length !== uniqueInvestigationIds.length) {
    return res.status(400).json({ error: "One or more investigations are invalid" });
  }
  const inactive = selected.find((item) => !item.active);
  if (inactive) {
    return res.status(400).json({ error: "One or more investigations are inactive" });
  }
  const total = selected.reduce((sum, item) => sum + investigationCharge(item), 0);
  const result = await db.transaction(async (tx) => {
    const [patient] = await tx.insert(patients).values({
      facilityId: body.facilityId,
      patientNumber: prefixNumber("PAT"),
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender,
      phone: body.phone,
      email: body.email,
      address: body.address,
      nhisNumber: body.nhisNumber,
      nhisStatus: body.nhisStatus,
    }).returning();

    const [order] = await tx.insert(labOrders).values({
      orderNumber: prefixNumber("LAB"),
      patientId: patient.id,
      facilityId: body.facilityId,
      createdBy: req.appUser!.id,
      clinicianName: body.clinicianName,
      notes: body.notes,
      totalAmount: total.toFixed(2),
    }).returning();

    await tx.insert(orderItems).values(selected.map((item) => ({
      orderId: order.id,
      investigationId: item.id,
      quantity: 1,
      unitPrice: investigationCharge(item).toFixed(2),
      lineTotal: investigationCharge(item).toFixed(2),
    })));

    return { patient, order };
  });

  res.status(201).json({
    ...result,
    totalAmount: total.toFixed(2),
  });
}));

api.post("/orders", requireRole("admin", "frontdesk"), asyncRoute(async (req, res) => {
  const body = z.object({
    facilityId: z.uuid(),
    patientId: z.uuid(),
    clinicianName: z.string().optional(),
    notes: z.string().optional(),
    investigationIds: z.array(z.uuid()).min(1),
  }).parse(req.body);
  const selected = await db.select().from(investigations).where(sql`${investigations.id} in ${body.investigationIds}`);
  if (selected.length !== body.investigationIds.length) {
    return res.status(400).json({ error: "One or more investigations are invalid" });
  }
  const inactive = selected.find((item) => !item.active);
  if (inactive) return res.status(400).json({ error: "One or more investigations are inactive" });

  const patient = await db.query.patients.findFirst({ where: eq(patients.id, body.patientId) });
  if (!patient) return res.status(404).json({ error: "Patient not found" });

  const total = selected.reduce((sum, item) => sum + investigationCharge(item), 0);
  const [order] = await db.insert(labOrders).values({
    orderNumber: prefixNumber("LAB"),
    patientId: body.patientId,
    facilityId: body.facilityId,
    createdBy: req.appUser!.id,
    clinicianName: body.clinicianName,
    notes: body.notes,
    totalAmount: total.toFixed(2),
  }).returning();
  await db.insert(orderItems).values(selected.map((item) => ({
    orderId: order.id,
    investigationId: item.id,
    quantity: 1,
    unitPrice: investigationCharge(item).toFixed(2),
    lineTotal: investigationCharge(item).toFixed(2),
  })));
  res.status(201).json(await db.query.labOrders.findFirst({ where: eq(labOrders.id, order.id) }));
}));

api.get("/orders", asyncRoute(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const rows = await db.select().from(labOrders).orderBy(desc(labOrders.createdAt)).limit(200);
  res.json(status ? rows.filter((row) => row.status === status) : rows);
}));

api.get("/orders/:id", asyncRoute(async (req, res) => {
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const patient = await db.query.patients.findFirst({ where: eq(patients.id, order.patientId) });
  res.json({ ...order, patient, items });
}));

api.get("/payments/paystack/config", requireRole("admin", "account"), asyncRoute(async (_req, res) => {
  res.json({
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  });
}));

api.post("/orders/:id/payments", requireRole("admin", "account"), asyncRoute(async (req, res) => {
  const body = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(["cash", "card", "mobile_money", "bank", "insurance"]),
    reference: z.string().optional(),
  }).parse(req.body);
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (body.method === "mobile_money") {
    if (!body.reference) return res.status(400).json({ error: "Paystack payment reference is required" });
    if (!process.env.PAYSTACK_SECRET_KEY) return res.status(500).json({ error: "Paystack is not configured" });
    const verifyResponse = await fetchWithTimeout(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    );
    const verifyBody = await verifyResponse.json().catch(() => null) as {
      status?: boolean;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        metadata?: { orderId?: string } | null;
      };
    } | null;
    const verifiedAmount = numberValue(verifyBody?.data?.amount) / 100;
    if (!verifyResponse.ok || !verifyBody?.status || verifyBody.data?.status !== "success") {
      return res.status(400).json({ error: "Paystack payment could not be verified" });
    }
    if (verifyBody.data?.metadata?.orderId !== order.id) {
      return res.status(400).json({ error: "Verified Paystack payment does not belong to this order" });
    }
    const profile = (await db.select().from(laboratoryProfiles).limit(1))[0];
    const expectedCurrency = (profile?.currency || "GHS").toUpperCase();
    if (!verifyBody.data?.currency ||
        verifyBody.data.currency.toUpperCase() !== expectedCurrency) {
      return res.status(400).json({ error: "Verified Paystack currency does not match the order currency" });
    }
    if (Math.abs(verifiedAmount - body.amount) > 0.001) {
      return res.status(400).json({ error: "Verified Paystack amount does not match the payment" });
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [lockedOrder] = await tx.select().from(labOrders)
        .where(eq(labOrders.id, order.id))
        .for("update");
      if (!lockedOrder) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

      const paid = numberValue(lockedOrder.paidAmount);
      const total = numberValue(lockedOrder.totalAmount);
      if (paid + body.amount > total) {
        throw Object.assign(new Error("Payment exceeds outstanding balance"), { statusCode: 400 });
      }
      const newPaid = paid + body.amount;
      const [payment] = await tx.insert(payments).values({
        receiptNumber: prefixNumber("RCP"),
        orderId: lockedOrder.id,
        amount: body.amount.toFixed(2),
        method: body.method,
        reference: body.reference,
        receivedBy: req.appUser!.id,
      }).returning();
      await tx.update(labOrders).set({
        paidAmount: newPaid.toFixed(2),
        paymentStatus: newPaid >= total ? "paid" : "partial",
        status: newPaid >= total ? "processing" : "awaiting_payment",
      }).where(eq(labOrders.id, lockedOrder.id));
      return payment;
    });
    res.status(201).json(result);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error &&
        (error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "This payment reference has already been received" });
    }
    if (error && typeof error === "object" && "cause" in error) {
      const cause = (error as { cause?: { code?: string } }).cause;
      if (cause?.code === "23505") return res.status(409).json({ error: "This payment reference has already been received" });
    }
    if (error && typeof error === "object" && "statusCode" in error) {
      const statusError = error as { statusCode: number; message: string };
      return res.status(statusError.statusCode).json({ error: statusError.message });
    }
    throw error;
  }
}));

api.get("/payments/:id/receipt", asyncRoute(async (req, res) => {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, String(req.params.id)) });
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, payment.orderId) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  const patient = await db.query.patients.findFirst({ where: eq(patients.id, order.patientId) });
  const profile = (await db.select().from(laboratoryProfiles).limit(1))[0];
  const receiver = await db.query.users.findFirst({ where: eq(users.id, payment.receivedBy) });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${payment.receiptNumber}.pdf"`);
  const pdf = new PDFDocument({ size: [226.77, 600], margin: 18 });
  pdf.pipe(res);
  if (profile?.logoUrl) {
    try {
      const logo = await readLimitedImage(profile.logoUrl);
      pdf.image(logo, (pdf.page.width - 44) / 2, pdf.y, {
        fit: [44, 44],
        align: "center",
        valign: "center",
      });
      pdf.moveDown(2);
    } catch {
      // Receipt printing should continue when a remote logo is unavailable.
    }
  }
  pdf.fontSize(14).text(profile?.name || "Laboratory", { align: "center" });
  if (profile?.address) pdf.fontSize(8).text(profile.address, { align: "center" });
  if (profile?.phone) pdf.fontSize(8).text(profile.phone, { align: "center" });
  if (profile?.email) pdf.fontSize(8).text(profile.email, { align: "center" });
  if (profile?.slogan) pdf.fontSize(9).text(profile.slogan, { align: "center", oblique: true });
  pdf.moveDown();
  pdf.fontSize(11).text("OFFICIAL PAYMENT RECEIPT", { align: "center", underline: true });
  pdf.moveDown();
  pdf.fontSize(9);
  pdf.text(`Receipt: ${payment.receiptNumber}`);
  pdf.text(`Order: ${order.orderNumber}`);
  pdf.text(`Patient: ${patient?.firstName || ""} ${patient?.lastName || ""}`);
  pdf.text(`Patient ID: ${patient?.patientNumber || ""}`);
  pdf.text(`Date: ${payment.receivedAt.toLocaleString()}`);
  pdf.moveDown();
  pdf.text(`Amount paid: GH${String.fromCharCode(162)} ${numberValue(payment.amount).toFixed(2)}`, { continued: false });
  pdf.text(`Payment mode: ${payment.method.replace("_", " ").toUpperCase()}`);
  if (payment.reference) pdf.text(`Reference: ${payment.reference}`);
  const orderPayments = await db.select().from(payments)
    .where(eq(payments.orderId, order.id))
    .orderBy(asc(payments.receivedAt), asc(payments.id));
  let receivedThroughReceipt = 0;
  for (const orderPayment of orderPayments) {
    receivedThroughReceipt += numberValue(orderPayment.amount);
    if (orderPayment.id === payment.id) break;
  }
  pdf.text(`Outstanding: GH${String.fromCharCode(162)} ${Math.max(0, numberValue(order.totalAmount) - receivedThroughReceipt).toFixed(2)}`);
  pdf.moveDown();
  pdf.text(`Received by: ${receiver?.name || "Authorized user"}`);
  pdf.moveDown();
  pdf.fontSize(8).text("Thank you", { align: "center" });
  pdf.end();
}));

api.patch("/orders/:orderId/items/:itemId/status", requireRole("admin", "technician"), asyncRoute(async (req, res) => {
  const body = z.object({
    sampleStatus: z.enum(["not_collected", "collected", "rejected", "received"]),
  }).parse(req.body);
  const timestamp = body.sampleStatus === "collected" ? { collectedAt: new Date() }
    : body.sampleStatus === "received" ? { receivedAt: new Date() } : {};
  const orderId = String(req.params.orderId);
  const itemId = String(req.params.itemId);
  const [updated] = await db.update(orderItems).set({ sampleStatus: body.sampleStatus, ...timestamp })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId))).returning();
  if (!updated) return res.status(404).json({ error: "Order item not found" });
  res.json(updated);
}));

api.post("/orders/:orderId/items/:itemId/results", requireRole("admin", "technician"), asyncRoute(async (req, res) => {
  const body = z.object({
    results: z.array(z.object({
      parameterId: z.uuid(),
      value: z.string(),
      abnormalFlag: z.enum(["normal", "high", "low", "critical"]).optional(),
      remarks: z.string().optional(),
    })).min(1),
  }).parse(req.body);
  const orderId = String(req.params.orderId);
  const itemId = String(req.params.itemId);
  const orderItem = await db.query.orderItems.findFirst({ where: eq(orderItems.id, itemId) });
  if (!orderItem || orderItem.orderId !== orderId) {
    return res.status(404).json({ error: "Order item not found" });
  }
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, orderId) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (numberValue(order.paidAmount) < numberValue(order.totalAmount)) {
    return res.status(409).json({ error: "Payment must be received in full before results can be captured" });
  }
  await db.transaction(async (tx) => {
    await tx.delete(resultEntries).where(eq(resultEntries.orderItemId, itemId));
    const orderItem = await tx.query.orderItems.findFirst({ where: eq(orderItems.id, itemId) });
    const order = orderItem
      ? await tx.query.labOrders.findFirst({ where: eq(labOrders.id, orderItem.orderId) })
      : null;
    const patient = order
      ? await tx.query.patients.findFirst({ where: eq(patients.id, order.patientId) })
      : null;
    const parameterIds = [...new Set(body.results.map((result) => result.parameterId))];
    const parameterRows = parameterIds.length
      ? await tx.select().from(parameters).where(sql`${parameters.id} in ${parameterIds}`)
      : [];
    const rangeRows = parameterIds.length
      ? await tx.select().from(parameterReferenceRanges)
          .where(sql`${parameterReferenceRanges.parameterId} in ${parameterIds}`)
          .orderBy(asc(parameterReferenceRanges.sortOrder), asc(parameterReferenceRanges.id))
      : [];
    await tx.insert(resultEntries).values(body.results.map((result) => {
      const parameter = parameterRows.find((row) => row.id === result.parameterId);
      let abnormalFlag = result.abnormalFlag;
      let referenceLow: string | null = null;
      let referenceHigh: string | null = null;
      const trimmedValue = result.value.trim();
      const numericValue = trimmedValue === "" ? NaN : Number(trimmedValue);
      let matchedRange = null;
      if (parameter && Number.isFinite(numericValue)) {
        const patientGender = patient?.gender?.toLowerCase();
        const age = patient?.dateOfBirth ? calendarAge(patient.dateOfBirth, new Date()) : null;
        matchedRange = rangeRows.find((range) => {
          if (range.parameterId !== parameter.id) return false;
          const genderMatches = range.gender === "all" || (patientGender != null && range.gender === patientGender);
          const ageMatches = age === null
            ? range.ageMin === 0 && range.ageMax === null
            : age >= range.ageMin &&
            (range.ageMax === null || age <= range.ageMax);
          return genderMatches && ageMatches;
        }) ?? null;
      }
      if (parameter?.dataType === "number" && matchedRange && result.abnormalFlag == null && Number.isFinite(numericValue)) {
        referenceLow = matchedRange.referenceLow;
        referenceHigh = matchedRange.referenceHigh;
        if (referenceLow != null && numericValue < Number(referenceLow)) abnormalFlag = "low";
        else if (referenceHigh != null && numericValue > Number(referenceHigh)) abnormalFlag = "high";
        else if (referenceLow != null || referenceHigh != null) abnormalFlag = "normal";
      } else if (parameter?.dataType === "number" && result.abnormalFlag == null && Number.isFinite(numericValue) &&
                 parameter.referenceLow != null && parameter.referenceHigh != null) {
        referenceLow = parameter.referenceLow;
        referenceHigh = parameter.referenceHigh;
        abnormalFlag = numericValue < Number(referenceLow)
          ? "low"
          : numericValue > Number(referenceHigh)
            ? "high"
            : "normal";
      }
      return {
        orderItemId: itemId,
        parameterId: result.parameterId,
        value: result.value,
        abnormalFlag,
        referenceLow,
        referenceHigh,
        remarks: result.remarks,
        enteredBy: req.appUser!.id,
      };
    }));
  });
  await db.update(labOrders).set({ status: "processing" }).where(eq(labOrders.id, orderId));
  res.status(201).json({ saved: body.results.length });
}));

api.post("/orders/:id/complete", requireRole("admin", "technician"), asyncRoute(async (req, res) => {
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (numberValue(order.paidAmount) < numberValue(order.totalAmount)) {
    return res.status(409).json({ error: "Payment must be received in full before the report can be completed" });
  }
  const [updated] = await db.update(labOrders).set({ status: "completed" }).where(eq(labOrders.id, order.id)).returning();
  if (!updated) return res.status(404).json({ error: "Order not found" });
  res.json(updated);
}));

api.get("/orders/:id/report", asyncRoute(async (req, res) => {
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "completed") return res.status(409).json({ error: "Report is available only after completion" });
  const patient = await db.query.patients.findFirst({ where: eq(patients.id, order.patientId) });
  const profile = (await db.select().from(laboratoryProfiles).limit(1))[0];
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${order.orderNumber}.pdf"`);
  const pdf = new PDFDocument({ size: "A4", margin: 50 });
  pdf.pipe(res);
  if (profile?.logoUrl) {
    try {
      const logo = await readLimitedImage(profile.logoUrl);
      pdf.image(logo, (pdf.page.width - 64) / 2, pdf.y, {
        fit: [64, 64],
        align: "center",
        valign: "center",
      });
      pdf.moveDown(3);
    } catch {
      // Report printing should continue when the remote logo is unavailable.
    }
  }
  pdf.fontSize(18).text(profile?.name || "Laboratory", { align: "center" });
  pdf.fontSize(10).text(profile?.address || "", { align: "center" });
  if (profile?.phone) pdf.text(profile.phone, { align: "center" });
  pdf.moveDown();
  pdf.fontSize(16).text("Laboratory Test Report", { align: "center" });
  pdf.moveDown();
  pdf.fontSize(11).text(`Patient: ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`);
  pdf.text(`Patient ID: ${patient?.patientNumber ?? ""}`);
  pdf.text(`Order: ${order.orderNumber}`);
  pdf.text(`Date: ${order.createdAt.toLocaleDateString()}`);
  pdf.moveDown();

  for (const item of items) {
    const investigation = await db.query.investigations.findFirst({ where: eq(investigations.id, item.investigationId) });
    pdf.fontSize(12).text(investigation?.name || "Investigation", { underline: true });
    const rows = await db.select().from(resultEntries).where(eq(resultEntries.orderItemId, item.id));
    for (const row of rows) {
      const parameter = await db.query.parameters.findFirst({ where: eq(parameters.id, row.parameterId) });
      pdf.fontSize(10).text(`${parameter?.name ?? "Parameter"}: ${row.value}${parameter?.unit ? ` ${parameter.unit}` : ""}${row.abnormalFlag ? ` (${row.abnormalFlag})` : ""}`);
      if (row.referenceLow != null || row.referenceHigh != null) {
        const interval = `${row.referenceLow != null ? row.referenceLow : "—"} to ${row.referenceHigh != null ? row.referenceHigh : "—"}${parameter?.unit ? ` ${parameter.unit}` : ""}`;
        pdf.fontSize(8).text(`Reference interval: ${interval}`);
      } else if (parameter?.referenceRange) {
        pdf.fontSize(8).text(`Reference: ${parameter.referenceRange}`);
      }
    }
    pdf.moveDown();
  }
  pdf.end();
}));

api.get("/reports/summary", requireRole("admin", "doctor"), asyncRoute(async (req, res) => {
  const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
  const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
  const rows = await db.select().from(labOrders).where(and(gte(labOrders.createdAt, from), lte(labOrders.createdAt, to)));
  res.json({
    period: { from, to },
    totalOrders: rows.length,
    completed: rows.filter((row) => row.status === "completed").length,
    pending: rows.filter((row) => row.status !== "completed" && row.status !== "cancelled").length,
    totalBilled: rows.reduce((sum, row) => sum + numberValue(row.totalAmount), 0),
    totalCollected: rows.reduce((sum, row) => sum + numberValue(row.paidAmount), 0),
  });
}));

api.post("/nhia/claims", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    facilityId: z.uuid(),
    claimPeriodStart: z.iso.datetime(),
    claimPeriodEnd: z.iso.datetime(),
  }).parse(req.body);
  const start = new Date(body.claimPeriodStart);
  const end = new Date(body.claimPeriodEnd);
  const eligibleOrders = await db.select().from(labOrders).where(and(
    eq(labOrders.facilityId, body.facilityId),
    gte(labOrders.createdAt, start),
    lte(labOrders.createdAt, end),
  ));
  const nhiaPayload = await Promise.all(eligibleOrders.map(async (order) => {
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, order.patientId) });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return {
      orderNumber: order.orderNumber,
      nhisNumber: patient?.nhisNumber ?? null,
      patientName: `${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`.trim(),
      investigations: await Promise.all(items.map(async (item) => {
        const investigation = await db.query.investigations.findFirst({ where: eq(investigations.id, item.investigationId) });
        return { nhiaCode: investigation?.nhiaCode ?? null, name: investigation?.name, amount: item.lineTotal };
      })),
    };
  }));
  const total = nhiaPayload.reduce((sum, claim) => sum + claim.investigations.reduce((itemSum, item) => itemSum + numberValue(item.amount), 0), 0);
  const [created] = await db.insert(nhiaClaims).values({
    claimNumber: prefixNumber("NHIA"),
    facilityId: body.facilityId,
    claimPeriodStart: start,
    claimPeriodEnd: end,
    payload: nhiaPayload,
    totalAmount: total.toFixed(2),
    createdBy: req.appUser!.id,
  }).returning();
  res.status(201).json(created);
}));

api.get("/nhia/claims", requireRole("admin"), asyncRoute(async (_req, res) => {
  res.json(await db.select().from(nhiaClaims).orderBy(desc(nhiaClaims.createdAt)));
}));

api.patch("/nhia/claims/:id/status", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({ status: z.enum(["draft", "submitted", "accepted", "rejected", "paid"]) }).parse(req.body);
  const [updated] = await db.update(nhiaClaims).set({
    status: body.status,
    submittedAt: body.status === "submitted" ? new Date() : undefined,
  }).where(eq(nhiaClaims.id, String(req.params.id))).returning();
  if (!updated) return res.status(404).json({ error: "Claim not found" });
  res.json(updated);
}));
