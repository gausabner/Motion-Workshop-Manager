-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "description" TEXT;


-- Backfill from the first line of every document that already exists.
UPDATE "Document" d
SET "description" = LEFT(l."description", 120)
FROM "DocumentLine" l
WHERE l."documentId" = d."id"
  AND l."sortOrder" = (SELECT MIN(l2."sortOrder") FROM "DocumentLine" l2 WHERE l2."documentId" = d."id")
  AND d."description" IS NULL;
