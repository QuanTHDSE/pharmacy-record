-- Generate concurrency-safe patient codes in the API using this sequence.
CREATE SEQUENCE "patients_patient_code_seq"
  AS BIGINT
  MINVALUE 1;

-- Preserve existing codes and start after the greatest numeric BN suffix.
DO $$
DECLARE
  next_value BIGINT;
BEGIN
  SELECT COALESCE(MAX(substring("patient_code" FROM '^BN-([0-9]+)$')::BIGINT), 0) + 1
  INTO next_value
  FROM "patients"
  WHERE "patient_code" ~ '^BN-[0-9]+$';

  PERFORM setval('patients_patient_code_seq'::regclass, next_value, false);
END $$;
