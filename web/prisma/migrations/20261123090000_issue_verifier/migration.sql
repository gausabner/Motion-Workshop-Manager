-- The storeman's "verified by" on a handover, kept as it stood when it was signed.
ALTER TABLE "RequisitionIssue" ADD COLUMN "issuedByName" TEXT,
ADD COLUMN "issuedByPayNumber" TEXT;

-- Handovers already made: copy the issuer as they stand now, the nearest record there is.
UPDATE "RequisitionIssue" AS i
SET "issuedByName" = trim(concat_ws(' ', u."firstName", u."lastName")),
    "issuedByPayNumber" = m."payNumber"
FROM "Membership" AS m
JOIN "User" AS u ON u."id" = m."userId"
WHERE m."id" = i."issuedById";
