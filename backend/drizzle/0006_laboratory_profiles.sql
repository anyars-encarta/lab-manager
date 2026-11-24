CREATE TABLE "laboratory_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"logo_url" text,
	"address" text,
	"phone" varchar(30),
	"email" varchar(200),
	"slogan" text,
	"currency" varchar(10) DEFAULT 'GHS' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "laboratory_profiles_facility_id_unique" UNIQUE("facility_id")
);
--> statement-breakpoint
ALTER TABLE "laboratory_profiles" ADD CONSTRAINT "laboratory_profiles_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;
