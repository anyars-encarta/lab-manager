import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { auth } from "./auth.js";
import { db } from "./db";
import {
  facilities,
  investigations,
  labOrders,
  nhiaClaims,
  orderItems,
  parameters,
  patients,
  payments,
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
const prefixNumber = (prefix: string) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
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

api.get("/facilities", asyncRoute(async (_req, res) => {
  res.json(await db.select().from(facilities).orderBy(asc(facilities.name)));
}));

api.post("/facilities", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2),
    code: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    nhiaFacilityCode: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const [created] = await db.insert(facilities).values(body).returning();
  res.status(201).json(created);
}));

api.patch("/facilities/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).optional(),
    code: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    nhiaFacilityCode: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  }).parse(req.body);
  const id = String(req.params.id);
  const [updated] = await db.update(facilities).set(body).where(eq(facilities.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Facility not found" });
  res.json(updated);
}));

api.get("/investigations", asyncRoute(async (req, res) => {
  const rows = await db.query.investigations.findMany({
    where: req.query.facilityId ? eq(investigations.facilityId, String(req.query.facilityId)) : undefined,
    orderBy: asc(investigations.name),
  });
  res.json(rows);
}));

api.post("/investigations", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    facilityId: z.uuid(),
    code: z.string().min(1),
    name: z.string().min(2),
    category: z.string().optional(),
    specimenType: z.string().optional(),
    price: z.coerce.number().nonnegative(),
    nhiaCode: z.string().optional(),
  }).parse(req.body);
  const [created] = await db.insert(investigations).values({
    ...body,
    price: body.price.toFixed(2),
  }).returning();
  res.status(201).json(created);
}));

api.patch("/investigations/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(2).optional(),
    category: z.string().optional(),
    specimenType: z.string().optional(),
    price: z.coerce.number().nonnegative().optional(),
    nhiaCode: z.string().optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  const id = String(req.params.id);
  const values = body.price === undefined
    ? { code: body.code, name: body.name, category: body.category, specimenType: body.specimenType, nhiaCode: body.nhiaCode, active: body.active }
    : { code: body.code, name: body.name, category: body.category, specimenType: body.specimenType, nhiaCode: body.nhiaCode, active: body.active, price: body.price.toFixed(2) };
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
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    dataType: z.enum(["text", "number", "boolean"]).default("text"),
    decimalPlaces: z.number().int().nonnegative().default(0),
    sortOrder: z.number().int().nonnegative().default(0),
  }).parse(req.body);
  const [created] = await db.insert(parameters).values({ ...body, investigationId: String(req.params.id) }).returning();
  res.status(201).json(created);
}));

api.patch("/parameters/:id", requireRole("admin"), asyncRoute(async (req, res) => {
  const body = z.object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    dataType: z.enum(["text", "number", "boolean"]).optional(),
    decimalPlaces: z.number().int().nonnegative().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
  }).parse(req.body);
  const [updated] = await db.update(parameters).set(body).where(eq(parameters.id, String(req.params.id))).returning();
  if (!updated) return res.status(404).json({ error: "Parameter not found" });
  res.json(updated);
}));

api.get("/patients", asyncRoute(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const rows = await db.select().from(patients).orderBy(desc(patients.createdAt)).limit(100);
  res.json(search ? rows.filter((patient) => `${patient.firstName} ${patient.lastName} ${patient.patientNumber} ${patient.nhisNumber ?? ""}`.toLowerCase().includes(search)) : rows);
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

  const total = selected.reduce((sum, item) => sum + numberValue(item.price), 0);
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
    unitPrice: item.price,
    lineTotal: item.price,
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

api.post("/orders/:id/payments", requireRole("admin", "account"), asyncRoute(async (req, res) => {
  const body = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(["cash", "card", "mobile_money", "bank", "insurance"]),
    reference: z.string().optional(),
  }).parse(req.body);
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });

  const paid = numberValue(order.paidAmount);
  const total = numberValue(order.totalAmount);
  if (paid + body.amount > total) return res.status(400).json({ error: "Payment exceeds outstanding balance" });
  const newPaid = paid + body.amount;
  const [payment] = await db.insert(payments).values({
    receiptNumber: prefixNumber("RCP"),
    orderId: order.id,
    amount: body.amount.toFixed(2),
    method: body.method,
    reference: body.reference,
    receivedBy: req.appUser!.id,
  }).returning();
  await db.update(labOrders).set({
    paidAmount: newPaid.toFixed(2),
    paymentStatus: newPaid >= total ? "paid" : "partial",
    status: newPaid >= total ? "processing" : "awaiting_payment",
  }).where(eq(labOrders.id, order.id));
  res.status(201).json(payment);
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
  await db.transaction(async (tx) => {
    await tx.delete(resultEntries).where(eq(resultEntries.orderItemId, itemId));
    await tx.insert(resultEntries).values(body.results.map((result) => ({
      orderItemId: itemId,
      parameterId: result.parameterId,
      value: result.value,
      abnormalFlag: result.abnormalFlag,
      remarks: result.remarks,
      enteredBy: req.appUser!.id,
    })));
  });
  await db.update(labOrders).set({ status: "processing" }).where(eq(labOrders.id, orderId));
  res.status(201).json({ saved: body.results.length });
}));

api.post("/orders/:id/complete", requireRole("admin", "technician"), asyncRoute(async (req, res) => {
  const [updated] = await db.update(labOrders).set({ status: "completed" }).where(eq(labOrders.id, String(req.params.id))).returning();
  if (!updated) return res.status(404).json({ error: "Order not found" });
  res.json(updated);
}));

api.get("/orders/:id/report", asyncRoute(async (req, res) => {
  const order = await db.query.labOrders.findFirst({ where: eq(labOrders.id, String(req.params.id)) });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "completed") return res.status(409).json({ error: "Report is available only after completion" });
  const patient = await db.query.patients.findFirst({ where: eq(patients.id, order.patientId) });
  const facility = await db.query.facilities.findFirst({ where: eq(facilities.id, order.facilityId) });
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${order.orderNumber}.pdf"`);
  const pdf = new PDFDocument({ size: "A4", margin: 50 });
  pdf.pipe(res);
  pdf.fontSize(18).text(facility?.name || "Laboratory", { align: "center" });
  pdf.fontSize(10).text(facility?.address || "", { align: "center" });
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
      if (parameter?.referenceRange) pdf.fontSize(8).text(`Reference: ${parameter.referenceRange}`);
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
