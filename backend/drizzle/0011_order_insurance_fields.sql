ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "is_insured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "lab_orders" AS "order"
SET "is_insured" = "patient"."is_insured"
FROM "patients" AS "patient"
WHERE "order"."patient_id" = "patient"."id";
