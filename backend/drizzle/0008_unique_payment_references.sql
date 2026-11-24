-- Reconcile duplicate non-null references before enforcing uniqueness.
-- Keep the chronologically latest payment for a reference and preserve older
-- payment rows by suffixing their references; null references remain unchanged.
WITH ranked AS (
  SELECT
    id,
    reference,
    row_number() OVER (
      PARTITION BY reference
      ORDER BY received_at DESC, id DESC
    ) AS duplicate_rank
  FROM "payments"
  WHERE reference IS NOT NULL
)
UPDATE "payments" AS payment
SET reference = substr(payment.reference, 1, 83)
  || '-dup-' || substr(replace(payment.id::text, '-', ''), 1, 8)
FROM ranked
WHERE payment.id = ranked.id
  AND ranked.duplicate_rank > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_reference_uidx" ON "payments" ("reference");
