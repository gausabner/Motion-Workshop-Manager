-- The check bay's two inspections (fleet job flow, part 4).
--
-- A council's check bay inspects every vehicle twice: an assessment when it
-- arrives, whose findings become the job card's work, and a quality check
-- before it is released, where a failed item sends it back to the workshop.
-- Both are MOTION's existing inspections, marked with what they are for and
-- tied to the check bay stay they were made in.

-- CreateEnum
CREATE TYPE "InspectionPurpose" AS ENUM ('GENERAL', 'ASSESSMENT', 'QUALITY_CHECK');

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "purpose" "InspectionPurpose" NOT NULL DEFAULT 'GENERAL',
ADD COLUMN     "visitId" TEXT;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "JobVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One check per check bay stay: a second "Start the assessment" from another
-- tablet finds the first rather than making a rival.
CREATE UNIQUE INDEX "Inspection_one_per_visit" ON "Inspection"("visitId") WHERE "visitId" IS NOT NULL;

-- A workshop's own inspection never belongs to a stay. (The reverse is not
-- enforced: a stay removed with its job leaves the inspection's purpose, as
-- history, with no stay to point at.)
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_general_has_no_visit" CHECK ("purpose" <> 'GENERAL' OR "visitId" IS NULL);
