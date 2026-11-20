ALTER TABLE "investigations" ADD COLUMN "gdrg_code" varchar(50);--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "reference_low" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "parameters" ADD COLUMN "reference_high" numeric(12, 4);