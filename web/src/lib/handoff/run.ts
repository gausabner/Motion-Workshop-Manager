import "server-only";
import { createHash } from "node:crypto";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { storage } from "@/lib/storage";
import { accountingSettings, handoffSettings } from "@/lib/settings/schema";
import { purchasesFor, receiptsFor, salesFor, supplierPaymentsFor } from "@/lib/accounting/queries";
import { ledgerBalances, ledgerFor, type LedgerAccounts } from "@/lib/handoff/ledger";
import { ledgerCsv, type LedgerShapeName } from "@/lib/handoff/shapes";
import { destinationKey, handoffFileName, resolveFolder } from "@/lib/handoff/destination";

/**
 * The nightly journal drop.
 *
 * MOTION writes a file; the ERP picks it up. Nothing listens and nothing is
 * exposed, which is the only shape a council network team will accept — and it
 * is also why every safeguard here has to work from our side alone. Once the
 * bytes are in the folder we have no idea what happens to them.
 *
 * Three things follow from that.
 *
 * The run is recorded before the file is written, and the record is what makes
 * a repeat safe. A schedule that fires twice — a retry, a clock change,
 * somebody pressing the button after cron already ran — finds the existing row
 * and stops. Without that, the receiving system gets the same day twice under
 * two names and has no way to tell.
 *
 * The journal is checked for balance before anything leaves, per batch as well
 * as overall, and a file that does not balance is not written at all. An ERP
 * will happily import an unbalanced journal and leave a suspense account for
 * somebody to find in March.
 *
 * And the bytes are checksummed, because a short file is otherwise
 * indistinguishable from a quiet Sunday.
 */

export type RunOutcome = {
    runId: string;
    state: "DELIVERED" | "FAILED" | "SKIPPED";
    /** Set when an earlier run already covered this period. */
    alreadyDone?: boolean;
    fileName?: string;
    key?: string;
    bytes?: number;
    rows?: number;
    checksum?: string;
    error?: string;
};

const sha256 = (body: Buffer) => createHash("sha256").update(body).digest("hex");
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Midnight UTC on the given calendar day, which is how periods are stored. */
const startOf = (day: string) => new Date(`${day}T00:00:00.000Z`);
const endOf = (day: string) => new Date(`${day}T23:59:59.999Z`);

export type JournalRunInput = {
    /** The calendar day the journal is for, in the workshop's own zone. */
    day: string;
    /** "schedule", or the membership that asked for it. */
    triggeredBy: string;
    /** Write it again even though a run already covered this day. */
    force?: boolean;
};

export async function runJournalHandoff(db: TenantDb, tenant: Tenant, input: JournalRunInput): Promise<RunOutcome> {
    const settings = handoffSettings(tenant.settings);
    const accounts = accountingSettings(tenant.settings);
    const shape = settings.shape as LedgerShapeName;
    const from = startOf(input.day);
    const to = endOf(input.day);
    const periodDay = startOf(input.day);

    const existing = await db.exportRun.findFirst({
        where: { kind: "JOURNAL", shape, periodFrom: periodDay, periodTo: periodDay },
    });
    if (existing && existing.state !== "FAILED" && !input.force) {
        return { runId: existing.id, state: "SKIPPED", alreadyDone: true, fileName: existing.fileName ?? undefined };
    }

    // Recorded before a byte is written. A run that dies halfway — the folder
    // is not mounted, the process is killed — leaves PENDING behind, which is
    // what the screen reports as "started and never finished". Leaving no row
    // at all would report it as "never ran", which is a different problem with
    // a different fix.
    const run = existing
        ? await db.exportRun.update({
            where: { id: existing.id },
            data: { state: "PENDING", startedAt: new Date(), finishedAt: null, error: null, triggeredBy: input.triggeredBy },
        })
        : await db.exportRun.create({
            data: {
                tenantId: tenant.id, kind: "JOURNAL", shape,
                periodFrom: periodDay, periodTo: periodDay,
                triggeredBy: input.triggeredBy, state: "PENDING",
            },
        });

    const fail = async (message: string): Promise<RunOutcome> => {
        await db.exportRun.update({ where: { id: run.id }, data: { state: "FAILED", error: message.slice(0, 500), finishedAt: new Date() } });
        return { runId: run.id, state: "FAILED", error: message };
    };

    try {
        const [sales, receipts, purchases, supplierPayments] = await Promise.all([
            salesFor(db, from, to),
            receiptsFor(db, from, to),
            purchasesFor(db, from, to),
            supplierPaymentsFor(db, from, to),
        ]);

        const ledgerAccounts: LedgerAccounts = {
            debtors: accounts.debtors, sales: accounts.sales, tax: accounts.tax,
            bank: accounts.bank, creditors: accounts.creditors,
            purchases: accounts.purchases, inputTax: accounts.inputTax,
        };
        const lines = ledgerFor({ sales, receipts, purchases, supplierPayments }, ledgerAccounts, input.day);

        // A day with no trade is a successful run that wrote nothing. Writing
        // an empty journal would have the receiving system import a file of
        // headers every Sunday, and the first real failure would look exactly
        // like every quiet weekend before it.
        if (lines.length === 0) {
            await db.exportRun.update({
                where: { id: run.id },
                data: { state: "DELIVERED", rows: 0, bytes: 0, finishedAt: new Date(), destination: null, storageKey: null, fileName: null },
            });
            return { runId: run.id, state: "DELIVERED", rows: 0, bytes: 0 };
        }

        const balance = ledgerBalances(lines);
        if (!balance.ok) {
            const where = balance.batches.map((b) => `${b.reference} out by ${b.offBy.toFixed(2)}`).join("; ");
            return fail(`The journal does not balance, so nothing was sent. ${where || `Out by ${balance.offBy.toFixed(2)}`}.`);
        }

        const body = Buffer.from(ledgerCsv(lines, shape), "utf8");
        const folder = resolveFolder({ folder: settings.folder, tenantSlug: tenant.slug, day: from });
        const fileName = handoffFileName(tenant.slug, "journal", shape, from, "csv");
        const key = destinationKey(folder, fileName);
        const driver = storage();

        await driver.put(key, body, { contentType: "text/csv; charset=utf-8", fileName });

        const checksum = sha256(body);
        await db.exportRun.update({
            where: { id: run.id },
            data: {
                state: "DELIVERED", destination: folder, storageDriver: driver.name, storageKey: key,
                fileName, bytes: body.length, rows: lines.length, checksum, finishedAt: new Date(), error: null,
            },
        });
        return { runId: run.id, state: "DELIVERED", fileName, key, bytes: body.length, rows: lines.length, checksum };
    } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
    }
}

/**
 * Which days a workshop still owes the receiving system.
 *
 * Read from the run records rather than from the documents, because a day with
 * no trade is a day that was handed off successfully with nothing in it, and a
 * day with no record at all is one the schedule missed. Those look identical
 * from the ledger and could not be less alike.
 */
export async function missingDays(db: TenantDb, from: Date, to: Date, shape: string): Promise<string[]> {
    const runs = await db.exportRun.findMany({
        where: { kind: "JOURNAL", shape, periodFrom: { gte: from, lte: to }, state: { in: ["DELIVERED", "ACKNOWLEDGED"] } },
        select: { periodFrom: true },
    });
    const done = new Set(runs.map((r) => isoDay(r.periodFrom)));
    const days: string[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86_400_000)) {
        const day = isoDay(d);
        if (!done.has(day)) days.push(day);
    }
    return days;
}
