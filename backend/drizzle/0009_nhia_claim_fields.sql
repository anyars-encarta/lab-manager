ALTER TABLE "laboratory_profiles" ADD COLUMN IF NOT EXISTS "pre_authorization_codes" text;
--> statement-breakpoint
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "claim_check_code" varchar(100);
--> statement-breakpoint
ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "claim_id" varchar(50);
--> statement-breakpoint
UPDATE "lab_orders"
SET "claim_id" = 'CLA-' || substr(replace(id::text, '-', ''), 1, 12)
WHERE "claim_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "lab_orders" ALTER COLUMN "claim_id" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lab_orders_claim_id_uidx" ON "lab_orders" ("claim_id");
