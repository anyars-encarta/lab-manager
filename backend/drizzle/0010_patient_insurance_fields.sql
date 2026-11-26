ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "is_insured" boolean DEFAULT false NOT NULL;
