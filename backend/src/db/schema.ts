import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "admin",
  "frontdesk",
  "account",
  "technician",
  "doctor",
]);

export const orderStatus = pgEnum("order_status", [
  "draft",
  "awaiting_payment",
  "paid",
  "processing",
  "completed",
  "cancelled",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "partial",
  "paid",
  "refunded",
]);

export const sampleStatus = pgEnum("sample_status", [
  "not_collected",
  "collected",
  "rejected",
  "received",
]);

export const claimStatus = pgEnum("claim_status", [
  "draft",
  "submitted",
  "accepted",
  "rejected",
  "paid",
]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("frontdesk"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export const facilities = pgTable("facilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  address: text("address"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  nhiaFacilityCode: varchar("nhia_facility_code", { length: 100 }),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientNumber: varchar("patient_number", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gender: varchar("gender", { length: 30 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 200 }),
  address: text("address"),
  nhisNumber: varchar("nhis_number", { length: 50 }),
  nhisStatus: varchar("nhis_status", { length: 30 }),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("patients_facility_idx").on(table.facilityId),
  index("patients_nhis_idx").on(table.nhisNumber),
]);

export const investigations = pgTable("investigations", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull(),
  gdrgCode: varchar("gdrg_code", { length: 50 }),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }),
  specimenType: varchar("specimen_type", { length: 100 }),
  price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
  coveredTariff: numeric("covered_tariff", { precision: 12, scale: 2 }).notNull().default("0"),
  uncoveredTariff: numeric("uncovered_tariff", { precision: 12, scale: 2 }).notNull().default("0"),
  topUp: numeric("top_up", { precision: 12, scale: 2 }).notNull().default("0"),
  nhiaCode: varchar("nhia_code", { length: 100 }),
  active: boolean("active").notNull().default(true),
  covered: boolean("covered").notNull().default(true),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("investigations_facility_idx").on(table.facilityId),
]);

export const parameters = pgTable("parameters", {
  id: uuid("id").primaryKey().defaultRandom(),
  investigationId: uuid("investigation_id").notNull().references(() => investigations.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  referenceRange: text("reference_range"),
  referenceLow: numeric("reference_low", { precision: 12, scale: 4 }),
  referenceHigh: numeric("reference_high", { precision: 12, scale: 4 }),
  dataType: varchar("data_type", { length: 30 }).notNull().default("text"),
  decimalPlaces: integer("decimal_places").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (table) => [
  check("parameters_reference_bounds_check", sql`(${table.referenceLow} is null or ${table.referenceHigh} is null or ${table.referenceLow} <= ${table.referenceHigh})`),
]);

export const parameterReferenceRanges = pgTable("parameter_reference_ranges", {
  id: uuid("id").primaryKey().defaultRandom(),
  parameterId: uuid("parameter_id").notNull().references(() => parameters.id, { onDelete: "cascade" }),
  gender: varchar("gender", { length: 30 }).notNull().default("all"),
  ageMin: integer("age_min").notNull().default(0),
  ageMax: integer("age_max"),
  referenceLow: numeric("reference_low", { precision: 12, scale: 4 }),
  referenceHigh: numeric("reference_high", { precision: 12, scale: 4 }),
  referenceRange: text("reference_range"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  check("reference_ranges_age_check", sql`${table.ageMin} >= 0 and (${table.ageMax} is null or ${table.ageMax} >= ${table.ageMin})`),
  check("reference_ranges_bounds_check", sql`(${table.referenceLow} is null or ${table.referenceHigh} is null or ${table.referenceLow} <= ${table.referenceHigh})`),
]);

export const labOrders = pgTable("lab_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  createdBy: text("created_by").notNull().references(() => users.id),
  status: orderStatus("status").notNull().default("draft"),
  paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  clinicianName: varchar("clinician_name", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("lab_orders_patient_idx").on(table.patientId),
  index("lab_orders_facility_idx").on(table.facilityId),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => labOrders.id, { onDelete: "cascade" }),
  investigationId: uuid("investigation_id").notNull().references(() => investigations.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  sampleStatus: sampleStatus("sample_status").notNull().default("not_collected"),
  collectedAt: timestamp("collected_at"),
  receivedAt: timestamp("received_at"),
});

export const resultEntries = pgTable("result_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  parameterId: uuid("parameter_id").notNull().references(() => parameters.id),
  value: text("value").notNull(),
  abnormalFlag: varchar("abnormal_flag", { length: 30 }),
  referenceLow: numeric("reference_low", { precision: 12, scale: 4 }),
  referenceHigh: numeric("reference_high", { precision: 12, scale: 4 }),
  remarks: text("remarks"),
  enteredBy: text("entered_by").notNull().references(() => users.id),
  verifiedBy: text("verified_by").references(() => users.id),
  enteredAt: timestamp("entered_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  orderId: uuid("order_id").notNull().references(() => labOrders.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: varchar("method", { length: 30 }).notNull(),
  reference: varchar("reference", { length: 100 }),
  receivedBy: text("received_by").notNull().references(() => users.id),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const nhiaClaims = pgTable("nhia_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  claimNumber: varchar("claim_number", { length: 50 }).notNull().unique(),
  facilityId: uuid("facility_id").notNull().references(() => facilities.id),
  claimPeriodStart: timestamp("claim_period_start").notNull(),
  claimPeriodEnd: timestamp("claim_period_end").notNull(),
  status: claimStatus("status").notNull().default("draft"),
  payload: jsonb("payload").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  submittedAt: timestamp("submitted_at"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
