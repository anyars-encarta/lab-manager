ALTER TABLE "investigations" ADD COLUMN "covered_tariff" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "uncovered_tariff" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "top_up" numeric(12, 2) DEFAULT '0' NOT NULL;