-- Somewhere to record that a hand-off happened, and whether it arrived.
--
-- MOTION can already write a journal. What it cannot do is answer "did last
-- night's file go out, and did the ERP take it" — and without that, the first
-- anyone learns of a month of failed imports is at year end, when somebody
-- tries to close the books. A drop with no record is not an integration; it is
-- a file appearing in a folder and a hope.
--
-- The unique constraint across tenant, kind, shape and period is the
-- idempotency. A nightly schedule that fires twice — a retry, a clock change,
-- somebody clicking the button after the cron already ran — must not produce
-- two files for the same night, because the receiving system has no way to
-- tell them apart and will post the day twice.
--
-- `acknowledgedAt` is the receipt leg. MOTION writes a file and the ERP is
-- expected to write one back; until that happens the run is delivered but not
-- confirmed, and the screen says so. Nothing listens for it — the receipt is
-- another file in another folder, read on the next run — because a council
-- network team will accept a job that reads a directory and will not accept a
-- service that waits on a port.
CREATE TYPE "ExportRunKind" AS ENUM ('JOURNAL', 'BUNDLE');
CREATE TYPE "ExportRunState" AS ENUM ('PENDING', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED');

CREATE TABLE "ExportRun" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "kind"           "ExportRunKind" NOT NULL,
    "state"          "ExportRunState" NOT NULL DEFAULT 'PENDING',
    -- Which column map was written, so a site that switches from Sage to
    -- QuickBooks does not look like it stopped sending anything.
    "shape"          TEXT NOT NULL DEFAULT 'motion',
    "periodFrom"     DATE NOT NULL,
    "periodTo"       DATE NOT NULL,
    -- Where it went and what it was, so a file found in a folder in eighteen
    -- months can be matched back to the run that produced it.
    "destination"    TEXT,
    "storageDriver"  TEXT,
    "storageKey"     TEXT,
    "fileName"       TEXT,
    "bytes"          INTEGER,
    "rows"           INTEGER,
    -- SHA-256 of the bytes written. The only way to tell a file that was
    -- truncated in transit from a quiet period.
    "checksum"       TEXT,
    "error"          TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    -- 'schedule' for an unattended run, or the membership that pressed the
    -- button. "Who sent the council last month's figures" is a question that
    -- gets asked.
    "triggeredBy"    TEXT NOT NULL DEFAULT 'schedule',
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"     TIMESTAMP(3),
    CONSTRAINT "ExportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExportRun_tenantId_kind_shape_periodFrom_periodTo_key"
    ON "ExportRun"("tenantId", "kind", "shape", "periodFrom", "periodTo");
CREATE INDEX "ExportRun_tenantId_startedAt_idx" ON "ExportRun"("tenantId", "startedAt");
CREATE INDEX "ExportRun_tenantId_state_idx" ON "ExportRun"("tenantId", "state");

ALTER TABLE "ExportRun" ADD CONSTRAINT "ExportRun_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A workshop's own record of what left the building. Forced, like everything
-- else that holds real work: an unattended job announces its tenant before it
-- reads or writes anything, exactly as a signed-in request does.
ALTER TABLE "ExportRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExportRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExportRun"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "ExportRun" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;
