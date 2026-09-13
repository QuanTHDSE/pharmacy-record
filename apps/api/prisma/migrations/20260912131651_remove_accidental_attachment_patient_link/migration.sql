/*
  Warnings:

  - You are about to drop the column `patientId` on the `medical_record_attachments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "medical_record_attachments" DROP CONSTRAINT "medical_record_attachments_patientId_fkey";

-- AlterTable
ALTER TABLE "medical_record_attachments" DROP COLUMN "patientId";
