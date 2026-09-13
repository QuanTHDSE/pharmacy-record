-- Exact patient-code lookup is already covered by the unique B-tree index.
DROP INDEX "patients_patient_code_prefix_idx";
