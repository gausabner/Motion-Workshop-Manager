-- Reversing a payment recorded in error, and the credit note that does it.
--
-- A tax invoice can never be changed or deleted (see the previous migration),
-- so the only correct way to undo one is a tax credit note that cancels it.
-- This adds the credit note — its own gap-free series, as final as the
-- invoice — and a mark on the payment saying it was reversed. Nothing is
-- deleted: what was recorded and then undone stays on the record.
--
-- Written after a paid-up workshop was renewed three times in under a minute
-- from a button that gave no sign it had worked. The button is fixed; this is
-- how the three invoices it issued get cancelled.

ALTER TABLE "SubscriptionPayment" ADD COLUMN "reversedAt" TIMESTAMP(3);

CREATE TABLE "SubscriptionCreditNote" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "invoiceId"     TEXT NOT NULL,
    "serial"        INTEGER NOT NULL,
    "number"        TEXT NOT NULL,
    "issuedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason"        TEXT NOT NULL,
    "supplier"      JSONB NOT NULL,
    "recipient"     JSONB NOT NULL,
    "description"   TEXT NOT NULL,
    "amountExclVat" DECIMAL(12,2) NOT NULL,
    "vatRate"       DECIMAL(5,2) NOT NULL,
    "vatAmount"     DECIMAL(12,2) NOT NULL,
    "amountInclVat" DECIMAL(12,2) NOT NULL,
    "currency"      TEXT NOT NULL DEFAULT 'NAD',
    "issuedById"    TEXT,
    "emailedAt"     TIMESTAMP(3),
    CONSTRAINT "SubscriptionCreditNote_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SubscriptionCreditNote_adds_up" CHECK ("amountExclVat" + "vatAmount" = "amountInclVat"),
    CONSTRAINT "SubscriptionCreditNote_serial_positive" CHECK ("serial" > 0),
    CONSTRAINT "SubscriptionCreditNote_has_reason" CHECK (length(trim("reason")) > 0)
);

CREATE UNIQUE INDEX "SubscriptionCreditNote_invoiceId_key" ON "SubscriptionCreditNote"("invoiceId");
CREATE UNIQUE INDEX "SubscriptionCreditNote_serial_key" ON "SubscriptionCreditNote"("serial");
CREATE UNIQUE INDEX "SubscriptionCreditNote_number_key" ON "SubscriptionCreditNote"("number");
CREATE INDEX "SubscriptionCreditNote_tenantId_issuedAt_idx" ON "SubscriptionCreditNote"("tenantId", "issuedAt");

ALTER TABLE "SubscriptionCreditNote" ADD CONSTRAINT "SubscriptionCreditNote_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionCreditNote" ADD CONSTRAINT "SubscriptionCreditNote_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- RESTRICT, not SET NULL: setting it null would be a change the trigger below
-- refuses, so a member of staff who issued a credit note stays on file.
ALTER TABLE "SubscriptionCreditNote" ADD CONSTRAINT "SubscriptionCreditNote_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Final once issued, exactly like the invoice it cancels.
CREATE OR REPLACE FUNCTION motion_subscription_credit_note_is_final() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'MOTION_TAX_RECORD: credit note % cannot be deleted.', OLD."number"
            USING ERRCODE = 'P0001';
    END IF;
    IF (to_jsonb(NEW) - 'emailedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'emailedAt') THEN
        RAISE EXCEPTION 'MOTION_TAX_RECORD: credit note % cannot be changed once issued.', OLD."number"
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER subscription_credit_note_is_final
    BEFORE UPDATE OR DELETE ON "SubscriptionCreditNote"
    FOR EACH ROW EXECUTE FUNCTION motion_subscription_credit_note_is_final();

ALTER TABLE "SubscriptionCreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionCreditNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubscriptionCreditNote"
    USING ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''))
    WITH CHECK ("tenantId" = NULLIF(current_setting('motion.tenant_id', true), ''));
CREATE POLICY platform_admin ON "SubscriptionCreditNote"
    USING (motion_is_platform_admin())
    WITH CHECK (motion_is_platform_admin());

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "SubscriptionCreditNote" TO motion_app;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_app';
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'motion_backup') THEN
        GRANT SELECT ON "SubscriptionCreditNote" TO motion_backup;
    END IF;
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'not permitted to grant to motion_backup';
END $$;
