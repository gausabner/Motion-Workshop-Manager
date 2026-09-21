-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "reworkOfId" TEXT,
ADD COLUMN     "reworkReason" TEXT,
ADD COLUMN     "splitFromId" TEXT;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_splitFromId_fkey" FOREIGN KEY ("splitFromId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reworkOfId_fkey" FOREIGN KEY ("reworkOfId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

