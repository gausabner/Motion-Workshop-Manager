import type { SequenceKey } from "@prisma/client";

/**
 * A workshop's own document numbers: what each series is called, what it
 * starts as, and what a workshop may change it to.
 *
 * Pure, so the rules can be tested without a database. The database side —
 * what has already been issued, and saving under a lock — is in
 * `lib/settings/numbering.ts`.
 */

/** The series a workshop sets, in the order the settings screen lists them. */
export const NUMBERED: { key: SequenceKey; label: string; hint: string }[] = [
    { key: "INVOICE", label: "Invoices", hint: "Invoices and cash sales — your tax invoices." },
    { key: "CREDIT", label: "Credit notes", hint: "What corrects an invoice." },
    { key: "QUOTE", label: "Quotes", hint: "Estimates sent before the work." },
    { key: "JOB", label: "Job cards", hint: "Job cards and bookings." },
    { key: "RECEIPT", label: "Receipts", hint: "Money taken from customers." },
    { key: "REFUND", label: "Refunds", hint: "Money paid back to customers." },
    { key: "INSPECTION", label: "Inspections", hint: "Vehicle inspections." },
    { key: "PURCHASE_ORDER", label: "Purchase orders", hint: "Orders placed with suppliers." },
    { key: "SUPPLIER_PAYMENT", label: "Supplier payments", hint: "Money paid to suppliers." },
];

/** Where a series starts before anybody has changed it. */
export const FIRST_NUMBER = 1001;

export function defaultPrefix(key: SequenceKey): string {
    switch (key) {
        case "QUOTE": return "Q-";
        case "JOB": return "JC-";
        case "INVOICE": return "INV-";
        case "CREDIT": return "CR-";
        case "RECEIPT": return "RC-";
        case "REFUND": return "RF-";
        case "INSPECTION": return "IN-";
        case "PURCHASE_ORDER": return "PO-";
        case "SUPPLIER_PAYMENT": return "SP-";
        // Reserved: a supplier invoice carries the supplier's own number.
        case "SUPPLIER_INVOICE": return "SI-";
    }
}

export const MAX_PREFIX = 12;
export const MAX_NEXT = 999_999_999;

/**
 * Letters, digits and the separators people actually use — `-`, `/` and `.` —
 * starting with a letter or digit, or nothing at all for plain numbers.
 * Nothing else: a space or a symbol in a document number is something a
 * customer has to read out over the phone and an accountant has to search for.
 */
export function prefixError(prefix: string): string | null {
    if (prefix === "") return null;
    if (prefix.length > MAX_PREFIX) return `Keep it to ${MAX_PREFIX} characters or fewer.`;
    if (!/^[A-Za-z0-9][A-Za-z0-9\-/.]*$/.test(prefix)) return "Letters, numbers, and - / . only, starting with a letter or number.";
    return null;
}

export function nextError(next: number): string | null {
    if (!Number.isInteger(next) || next < 1) return "A whole number, 1 or more.";
    if (next > MAX_NEXT) return "That number is too long.";
    return null;
}

/**
 * Two series may not share a prefix. A document number has to say what it is:
 * INV-1001 and a quote numbered INV-1001 would be two different documents
 * answering to one name. Compared without case, because a person reading
 * "inv-" and "INV-" sees the same thing.
 */
export function sharedPrefixes(prefixes: Partial<Record<SequenceKey, string>>): Set<SequenceKey> {
    const byPrefix = new Map<string, SequenceKey[]>();
    for (const [key, prefix] of Object.entries(prefixes) as [SequenceKey, string][]) {
        const k = prefix.toLowerCase();
        byPrefix.set(k, [...(byPrefix.get(k) ?? []), key]);
    }
    const clashing = new Set<SequenceKey>();
    for (const keys of byPrefix.values()) if (keys.length > 1) keys.forEach((k) => clashing.add(k));
    return clashing;
}

export const formatNumber = (prefix: string, n: number) => `${prefix}${n}`;
