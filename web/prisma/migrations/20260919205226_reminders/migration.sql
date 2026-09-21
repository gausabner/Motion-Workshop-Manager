-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('SERVICE_DUE', 'LICENCE_DISC', 'ROADWORTHY', 'BOOKING', 'QUOTE_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ReminderOutcome" AS ENUM ('SENT', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplateKind" ADD VALUE 'MESSAGE_REMINDER_SERVICE';
ALTER TYPE "TemplateKind" ADD VALUE 'MESSAGE_REMINDER_LICENCE';
ALTER TYPE "TemplateKind" ADD VALUE 'MESSAGE_REMINDER_ROADWORTHY';
ALTER TYPE "TemplateKind" ADD VALUE 'MESSAGE_REMINDER_BOOKING';
ALTER TYPE "TemplateKind" ADD VALUE 'MESSAGE_REMINDER_QUOTE';

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "outcome" "ReminderOutcome" NOT NULL,
    "customerId" TEXT,
    "vehicleId" TEXT,
    "documentId" TEXT,
    "messageId" TEXT,
    "actedById" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_tenantId_actedAt_idx" ON "Reminder"("tenantId", "actedAt");

-- CreateIndex
CREATE INDEX "Reminder_tenantId_customerId_idx" ON "Reminder"("tenantId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_tenantId_kind_targetId_dueOn_key" ON "Reminder"("tenantId", "kind", "targetId", "dueOn");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_actedById_fkey" FOREIGN KEY ("actedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

