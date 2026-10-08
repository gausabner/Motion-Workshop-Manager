-- Tax invoices for MOTION's own billing.
--
-- Omzizi Investment CC is registered for VAT, and the terms promise every
-- paying workshop "a tax invoice you can claim against". Until now a confirmed
-- payment produced a receipt email and nothing a workshop could file. This
-- adds the invoice: one per confirmed payment, numbered without gaps across
-- every workshop, with everything printed on it copied in at the moment it is
-- issued.

CREATE TABLE "SubscriptionInvoice" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "paymentId"        TEXT NOT NULL,
    "serial"           INTEGER NOT NULL,
    "number"           TEXT NOT NULL,
    "issuedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier"         JSONB NOT NULL,
    "recipient"        JSONB NOT NULL,
    "description"      TEXT NOT NULL,
    "periodFrom"       TIMESTAMP(3) NOT NULL,
    "periodTo"         TIMESTAMP(3) NOT NULL,
    "amountExclVat"    DECIMAL(12,2) NOT NULL,
    "vatRate"          DECIMAL(5,2) NOT NULL,
    "vatAmount"        DECIMAL(12,2) NOT NULL,
    "amountInclVat"    DECIMAL(12,2) NOT NULL,
    "currency"         TEXT NOT NULL DEFAULT 'NAD',
    "paymentReference" TEXT NOT NULL,
    "paidAt"           TIMESTAMP(3) NOT NULL,
    "emailedAt"        TIMESTAMP(3),
    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id"),
    -- The arithmetic a tax inspector would do, done by the database first.
    CONSTRAINT "SubscriptionInvoice_adds_up" CHECK ("amountExclVat" + "vatAmount" = "amountInclVat"),
    CONSTRAINT "SubscriptionInvoice_serial_positive" CHECK ("serial" > 0)
);

CREATE UNIQUE INDEX "SubscriptionInvoice_paymentId_key" ON "SubscriptionInvoice"("paymentId");
CREATE UNIQUE INDEX "SubscriptionInvoice_serial_key" ON "SubscriptionInvoice"("serial");
CREATE UNIQUE INDEX "SubscriptionInvoice_number_key" ON "SubscriptionInvoice"("number");
CREATE INDEX "SubscriptionInvoice_tenantId_issuedAt_idx" ON "SubscriptionInvoice"("tenantId", "issuedAt");

-- RESTRICT, not CASCADE, on both. Removing a workshop or a payment must not
-- quietly take a tax record with it; it has to be dealt with on purpose.
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Final once issued ───────────────────────────────────────────────────────
-- The only thing that may change on an issued invoice is when it was last
-- emailed. Everything else — the number, the parties, the money — is what was
-- issued, and a tax record is corrected with a credit note, never edited.
CREATE OR REPLACE FUNCTION motion_subscription_invoice_is_final() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'MOTION_TAX_RECORD: tax invoice % cannot be deleted. Correct it with a credit note.', OLD."number"
            USING ERRCODE = 'P0001';
    END IF;
    IF (to_jsonb(NEW) - 'emailedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'emailedAt') THEN
        RAISE EXCEPTION 'MOTION_TAX_RECORD: tax invoice % cannot be changed once issued.', OLD."number"
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER subscription_invoice_is_final
    BEFORE UPDATE OR DELETE ON "SubscriptionInvoice"
    FOR EACH ROW EXECUTE FUNCTION motion_subscription_invoice_is_final();

-- ── Who can see one ─────────────────────────────────────────────────────────
-- A workshop reads its own invoices — they are its tax records. Staff read and
-- issue all of them. The same pair of policies as the payments they belong to.
ALTER TABLE "SubscriptionInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionInvoice" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubscriptionInvoice"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));
CREATE POLICY platform_admin ON "SubscriptionInvoice"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "SubscriptionInvoice" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "SubscriptionInvoice" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;
