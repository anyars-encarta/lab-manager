ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "is_insured" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "patients"
SET "is_insured" = true
WHERE lower(trim(COALESCE("nhis_status", ''))) = 'active'
  AND btrim(COALESCE("nhis_number", '')) <> '';
