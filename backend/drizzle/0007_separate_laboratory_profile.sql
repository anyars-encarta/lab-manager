ALTER TABLE "laboratory_profiles" DROP CONSTRAINT IF EXISTS "laboratory_profiles_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "laboratory_profiles" DROP CONSTRAINT IF EXISTS "laboratory_profiles_facility_id_unique";
--> statement-breakpoint
ALTER TABLE "laboratory_profiles" DROP COLUMN IF EXISTS "facility_id";
--> statement-breakpoint
ALTER TABLE "laboratory_profiles" ADD COLUMN IF NOT EXISTS "name" varchar(200) DEFAULT 'Laboratory' NOT NULL;
