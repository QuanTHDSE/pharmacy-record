/*
  Warnings:

  - You are about to drop the column `medication_id` on the `allergies` table. All the data in the column will be lost.
  - You are about to drop the `medications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prescription_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prescriptions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "allergies" DROP CONSTRAINT "allergies_medication_id_fkey";

-- DropForeignKey
ALTER TABLE "prescription_items" DROP CONSTRAINT "prescription_items_medication_id_fkey";

-- DropForeignKey
ALTER TABLE "prescription_items" DROP CONSTRAINT "prescription_items_prescription_id_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_medical_record_id_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "prescriptions" DROP CONSTRAINT "prescriptions_prescribed_by_user_id_fkey";

-- DropIndex
DROP INDEX "allergies_medication_id_idx";

-- AlterTable
ALTER TABLE "allergies" DROP COLUMN "medication_id";

-- DropTable
DROP TABLE "medications";

-- DropTable
DROP TABLE "prescription_items";

-- DropTable
DROP TABLE "prescriptions";

-- DropEnum
DROP TYPE "prescription_status";
