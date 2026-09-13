-- Align the partial-index predicate with Prisma's normalized representation.
DROP INDEX "patients_patient_code_prefix_idx";

CREATE INDEX "patients_patient_code_prefix_idx"
ON "patients"("patient_code" varchar_pattern_ops)
WHERE ("deleted_at" IS NULL);
