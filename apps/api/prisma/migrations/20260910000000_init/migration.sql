-- PostgreSQL extensions used by case-insensitive fields and fuzzy search indexes.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'PHARMACIST');

-- CreateEnum
CREATE TYPE "gender_type" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "disease_status" AS ENUM ('ACTIVE', 'CHRONIC', 'RESOLVED');

-- CreateEnum
CREATE TYPE "allergy_type" AS ENUM ('MEDICATION', 'FOOD', 'ENVIRONMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "allergy_severity" AS ENUM ('UNKNOWN', 'MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "prescription_status" AS ENUM ('DRAFT', 'ISSUED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(150) NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_code" VARCHAR(30) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "date_of_birth" DATE,
    "gender" "gender_type",
    "phone" VARCHAR(20),
    "address" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" VARCHAR(200),
    "chief_complaint" TEXT,
    "clinical_notes" TEXT NOT NULL,
    "vital_signs" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diseases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(30),
    "name" CITEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "diseases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_diseases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "disease_id" UUID NOT NULL,
    "medical_record_id" UUID,
    "recorded_by_user_id" UUID NOT NULL,
    "status" "disease_status" NOT NULL DEFAULT 'ACTIVE',
    "diagnosed_at" DATE,
    "resolved_at" DATE,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "patient_diseases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "patient_diseases_resolved_after_diagnosed_check"
        CHECK ("resolved_at" IS NULL OR "diagnosed_at" IS NULL OR "resolved_at" >= "diagnosed_at")
);

-- CreateTable
CREATE TABLE "allergies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "medication_id" UUID,
    "medical_record_id" UUID,
    "recorded_by_user_id" UUID NOT NULL,
    "type" "allergy_type" NOT NULL DEFAULT 'OTHER',
    "allergen_name" CITEXT NOT NULL,
    "reaction" TEXT,
    "severity" "allergy_severity" NOT NULL DEFAULT 'UNKNOWN',
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "medication_code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active_ingredient" VARCHAR(300),
    "strength" VARCHAR(100),
    "dosage_form" VARCHAR(100),
    "unit" VARCHAR(50) NOT NULL,
    "manufacturer" VARCHAR(200),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prescription_code" VARCHAR(30) NOT NULL,
    "patient_id" UUID NOT NULL,
    "medical_record_id" UUID,
    "prescribed_by_user_id" UUID NOT NULL,
    "status" "prescription_status" NOT NULL DEFAULT 'DRAFT',
    "prescribed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" DATE,
    "note" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prescriptions_valid_until_check"
        CHECK ("valid_until" IS NULL OR "valid_until" >= "prescribed_at"::date)
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "prescription_id" UUID NOT NULL,
    "medication_id" UUID NOT NULL,
    "medication_name_snapshot" VARCHAR(200) NOT NULL,
    "strength_snapshot" VARCHAR(100),
    "dose" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(100) NOT NULL,
    "duration_days" INTEGER,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "route" VARCHAR(100),
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prescription_items_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "prescription_items_duration_days_positive_check"
        CHECK ("duration_days" IS NULL OR "duration_days" > 0)
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "request_id" UUID,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");
CREATE INDEX "users_full_name_idx" ON "users"("full_name");
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING GIN (lower("full_name") gin_trgm_ops);

CREATE UNIQUE INDEX "patients_patient_code_key" ON "patients"("patient_code");
CREATE INDEX "patients_patient_code_prefix_idx" ON "patients"("patient_code" varchar_pattern_ops) WHERE "deleted_at" IS NULL;
CREATE INDEX "patients_full_name_trgm_idx" ON "patients" USING GIN (lower("full_name") gin_trgm_ops) WHERE "deleted_at" IS NULL;
CREATE INDEX "patients_phone_trgm_idx" ON "patients" USING GIN ("phone" gin_trgm_ops) WHERE "deleted_at" IS NULL;
CREATE INDEX "patients_created_at_idx" ON "patients"("created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "patients_phone_idx" ON "patients"("phone") WHERE "deleted_at" IS NULL;

CREATE INDEX "medical_records_patient_recorded_at_idx" ON "medical_records"("patient_id", "recorded_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "medical_records_recorded_by_user_id_idx" ON "medical_records"("recorded_by_user_id");

CREATE UNIQUE INDEX "diseases_code_key" ON "diseases"("code");
CREATE UNIQUE INDEX "diseases_name_key" ON "diseases"("name");
CREATE INDEX "diseases_is_active_name_idx" ON "diseases"("is_active", "name");

CREATE INDEX "patient_diseases_patient_status_idx" ON "patient_diseases"("patient_id", "status") WHERE "deleted_at" IS NULL;
CREATE INDEX "patient_diseases_disease_id_idx" ON "patient_diseases"("disease_id");
CREATE INDEX "patient_diseases_medical_record_id_idx" ON "patient_diseases"("medical_record_id");
CREATE INDEX "patient_diseases_recorded_by_user_id_idx" ON "patient_diseases"("recorded_by_user_id");
CREATE UNIQUE INDEX "patient_diseases_patient_disease_key" ON "patient_diseases"("patient_id", "disease_id") WHERE "deleted_at" IS NULL;

CREATE INDEX "allergies_patient_severity_idx" ON "allergies"("patient_id", "severity") WHERE "deleted_at" IS NULL;
CREATE INDEX "allergies_medication_id_idx" ON "allergies"("medication_id");
CREATE INDEX "allergies_medical_record_id_idx" ON "allergies"("medical_record_id");
CREATE INDEX "allergies_recorded_by_user_id_idx" ON "allergies"("recorded_by_user_id");
CREATE UNIQUE INDEX "allergies_patient_allergen_key" ON "allergies"("patient_id", "allergen_name") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "medications_medication_code_key" ON "medications"("medication_code");
CREATE INDEX "medications_is_active_idx" ON "medications"("is_active") WHERE "deleted_at" IS NULL;
CREATE INDEX "medications_name_trgm_idx" ON "medications" USING GIN (lower("name") gin_trgm_ops) WHERE "deleted_at" IS NULL;
CREATE INDEX "medications_active_ingredient_trgm_idx" ON "medications" USING GIN (lower("active_ingredient") gin_trgm_ops) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "prescriptions_prescription_code_key" ON "prescriptions"("prescription_code");
CREATE INDEX "prescriptions_patient_prescribed_at_idx" ON "prescriptions"("patient_id", "prescribed_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "prescriptions_user_prescribed_at_idx" ON "prescriptions"("prescribed_by_user_id", "prescribed_at" DESC);
CREATE INDEX "prescriptions_status_prescribed_at_idx" ON "prescriptions"("status", "prescribed_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "prescriptions_medical_record_id_idx" ON "prescriptions"("medical_record_id");

CREATE INDEX "prescription_items_prescription_id_idx" ON "prescription_items"("prescription_id");
CREATE INDEX "prescription_items_medication_id_idx" ON "prescription_items"("medication_id");

CREATE INDEX "audit_logs_actor_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at" DESC);
CREATE INDEX "audit_logs_entity_occurred_at_idx" ON "audit_logs"("entity_type", "entity_id", "occurred_at" DESC);
CREATE INDEX "audit_logs_action_occurred_at_idx" ON "audit_logs"("action", "occurred_at" DESC);
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at" DESC);
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id") WHERE "request_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "patient_diseases" ADD CONSTRAINT "patient_diseases_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_diseases" ADD CONSTRAINT "patient_diseases_disease_id_fkey" FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_diseases" ADD CONSTRAINT "patient_diseases_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patient_diseases" ADD CONSTRAINT "patient_diseases_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allergies" ADD CONSTRAINT "allergies_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "allergies" ADD CONSTRAINT "allergies_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescribed_by_user_id_fkey" FOREIGN KEY ("prescribed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
