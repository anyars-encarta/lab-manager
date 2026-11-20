CREATE TABLE "parameter_reference_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parameter_id" uuid NOT NULL,
	"gender" varchar(30) DEFAULT 'all' NOT NULL,
	"age_min" integer DEFAULT 0 NOT NULL,
	"age_max" integer,
	"reference_low" numeric(12, 4),
	"reference_high" numeric(12, 4),
	"reference_range" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parameter_reference_ranges" ADD CONSTRAINT "parameter_reference_ranges_parameter_id_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "public"."parameters"("id") ON DELETE cascade ON UPDATE no action;