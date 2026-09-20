-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "clientRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_tenantId_clientRef_key" ON "TimeEntry"("tenantId", "clientRef");

