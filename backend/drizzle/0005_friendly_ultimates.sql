ALTER TABLE "investigations" ADD COLUMN "covered_tariff" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "uncovered_tariff" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "top_up" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
UPDATE "investigations"
SET
  "covered_tariff" = CASE WHEN "covered" = true THEN "price" ELSE '0' END,
  "uncovered_tariff" = CASE WHEN "covered" = false THEN "price" ELSE '0' END,
  "top_up" = '0';