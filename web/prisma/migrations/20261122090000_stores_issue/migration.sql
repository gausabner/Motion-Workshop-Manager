-- Stores requisitions (fleet job flow, part 5).
--
-- A part issued from stores against a job's requisition lands on the job card
-- as a line that remembers the requisition line it came from. The stock left
-- the shelf at the issue, so processing the job card, or the invoice it
-- becomes, must never move it a second time; the link is how the ledger knows.

-- AlterTable
ALTER TABLE "DocumentLine" ADD COLUMN     "requisitionLineId" TEXT;

-- AddForeignKey
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_requisitionLineId_fkey" FOREIGN KEY ("requisitionLineId") REFERENCES "RequisitionLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "DocumentLine_requisitionLineId_idx" ON "DocumentLine"("requisitionLineId") WHERE "requisitionLineId" IS NOT NULL;
