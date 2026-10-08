import "server-only";

import type { SequenceKey } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { defaultPrefix, FIRST_NUMBER, formatNumber, nextError, NUMBERED, prefixError, sharedPrefixes } from "@/lib/documents/numbering-rules";

/**
 * A workshop setting its own document numbers — the prefix on its invoices,
 * quotes and the rest, and where each series continues from.
 *
 * The one thing this must never allow is a number issued twice. Document
 * numbers are not unique in the database (a draft has none, and history
 * imported from another system may repeat), so the guarantee lives here:
 * a series may only continue *above* the highest number already issued with
 * its prefix, anywhere in the workshop. Moving to a new prefix can start
 * anywhere; going back to an old one has to continue past what it issued.
 */

export type NumberingRow = {
    key: SequenceKey;
    label: string;
    hint: string;
    prefix: string;
    next: number;
    /** The highest number already issued with this prefix, as printed. */
    lastIssued: string | null;
};

/**
 * The highest number already issued in this workshop under `prefix`, across
 * every table that carries one — 0 if none. Counted only where the rest of
 * the number is all digits, so "INV-1001" counts for "INV-" and not for "IN".
 */
export async function highestIssued(tx: TenantTx, tenantId: string, prefix: string): Promise<number> {
    // `prefixError` admits no % or _ (or backslash), so this is a plain prefix match.
    const like = `${prefix}%`;
    const from = prefix.length + 1;
    const rows = await tx.$queryRaw<{ max: bigint | null }[]>`
        SELECT max(CASE WHEN s ~ '^[0-9]{1,15}$' THEN s::bigint END) AS max FROM (
            SELECT substring("number" from ${from}::int) AS s FROM "Document" WHERE "tenantId" = ${tenantId} AND "number" LIKE ${like}
            UNION ALL SELECT substring("jobNumber" from ${from}::int) FROM "Document" WHERE "tenantId" = ${tenantId} AND "jobNumber" LIKE ${like}
            UNION ALL SELECT substring("number" from ${from}::int) FROM "Payment" WHERE "tenantId" = ${tenantId} AND "number" LIKE ${like}
            UNION ALL SELECT substring("number" from ${from}::int) FROM "Inspection" WHERE "tenantId" = ${tenantId} AND "number" LIKE ${like}
            UNION ALL SELECT substring("number" from ${from}::int) FROM "PurchaseOrder" WHERE "tenantId" = ${tenantId} AND "number" LIKE ${like}
            UNION ALL SELECT substring("number" from ${from}::int) FROM "SupplierPayment" WHERE "tenantId" = ${tenantId} AND "number" LIKE ${like}
        ) issued`;
    return Number(rows[0]?.max ?? 0);
}

export async function loadNumbering(db: TenantDb, tenantId: string): Promise<NumberingRow[]> {
    return db.$transaction(async (tx) => {
        const sequences = await tx.sequence.findMany({ where: { tenantId }, select: { key: true, prefix: true, next: true } });
        const rows: NumberingRow[] = [];
        for (const meta of NUMBERED) {
            const s = sequences.find((x) => x.key === meta.key);
            // A series nobody has used yet has no row; it starts where `allocateNumber` would start it.
            const prefix = s?.prefix ?? defaultPrefix(meta.key);
            const next = s?.next ?? FIRST_NUMBER;
            const high = await highestIssued(tx, tenantId, prefix);
            rows.push({ ...meta, prefix, next, lastIssued: high > 0 ? formatNumber(prefix, high) : null });
        }
        return rows;
    });
}

export type NumberingInput = Map<SequenceKey, { prefix: string; next: number }>;

export type NumberingResult =
    | { ok: true; changed: { key: SequenceKey; from: { prefix: string; next: number }; to: { prefix: string; next: number } }[] }
    | { ok: false; errors: Record<string, string[]> };

/**
 * Save new prefixes and next numbers, all or nothing.
 *
 * Every series row is locked first — created at its defaults if it has never
 * been used — so that no document can be numbered between the check against
 * what has been issued and the move. `allocateNumber` takes the same row
 * lock, so a counter processing an invoice at that moment waits a beat
 * rather than slipping a number into the gap.
 */
export async function saveNumbering(db: TenantDb, tenantId: string, actorUserId: string, input: NumberingInput): Promise<NumberingResult> {
    const errors: Record<string, string[]> = {};
    const add = (field: string, message: string) => (errors[field] = [...(errors[field] ?? []), message]);

    for (const [key, want] of input) {
        const pe = prefixError(want.prefix);
        if (pe) add(`prefix_${key}`, pe);
        const ne = nextError(want.next);
        if (ne) add(`next_${key}`, ne);
    }
    if (Object.keys(errors).length) return { ok: false, errors };

    return db.$transaction(async (tx) => {
        for (const { key } of NUMBERED) {
            await tx.sequence.upsert({
                where: { tenantId_key: { tenantId, key } },
                create: { tenantId, key, prefix: defaultPrefix(key), next: FIRST_NUMBER },
                update: {},
            });
        }
        await tx.$executeRaw`SELECT 1 FROM "Sequence" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
        const current = await tx.sequence.findMany({ where: { tenantId }, select: { id: true, key: true, prefix: true, next: true } });

        // What every series would be called afterwards, changed or not.
        const finalPrefix: Partial<Record<SequenceKey, string>> = {};
        for (const { key } of NUMBERED) finalPrefix[key] = input.get(key)?.prefix ?? current.find((c) => c.key === key)!.prefix;
        for (const key of sharedPrefixes(finalPrefix)) {
            if (input.has(key)) add(`prefix_${key}`, "Another kind of document uses this prefix. Each needs its own, so a number says what it is.");
        }

        const changed: { id: string; key: SequenceKey; from: { prefix: string; next: number }; to: { prefix: string; next: number } }[] = [];
        for (const [key, want] of input) {
            const cur = current.find((c) => c.key === key)!;
            if (cur.prefix === want.prefix && cur.next === want.next) continue;
            const high = await highestIssued(tx, tenantId, want.prefix);
            if (want.next <= high) {
                add(`next_${key}`, `${formatNumber(want.prefix, high)} has already been issued, so this has to be ${high + 1} or higher.`);
                continue;
            }
            changed.push({ id: cur.id, key, from: { prefix: cur.prefix, next: cur.next }, to: want });
        }
        if (Object.keys(errors).length) return { ok: false as const, errors };

        for (const c of changed) {
            await tx.sequence.update({ where: { id: c.id }, data: { prefix: c.to.prefix, next: c.to.next } });
            await tx.auditEvent.create({
                data: { tenantId, actorUserId, entityType: "Sequence", entityId: c.id, action: "UPDATED", diff: { key: c.key, from: c.from, to: c.to } },
            });
        }
        return { ok: true as const, changed: changed.map(({ key, from, to }) => ({ key, from, to })) };
    });
}
