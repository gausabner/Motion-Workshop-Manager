/**
 * Merge fields for footers, notes and messages (PRD SET-08).
 *
 * Pure: the same rendering runs for a printed invoice footer, a WhatsApp
 * message and a preview in the template editor, so what the workshop sees
 * while writing a template is what the customer gets.
 */

export type MergeValues = Record<string, string | number | null | undefined>;

export type MergeField = { key: string; label: string; group: "Workshop" | "Customer" | "Vehicle" | "Document" };

/** Everything a template may refer to. The editor lists these; unknown fields render as nothing. */
export const MERGE_FIELDS: MergeField[] = [
    { key: "workshop_name", label: "Workshop name", group: "Workshop" },
    { key: "workshop_phone", label: "Workshop phone", group: "Workshop" },
    { key: "workshop_email", label: "Workshop email", group: "Workshop" },
    { key: "workshop_address", label: "Workshop address", group: "Workshop" },
    { key: "vat_number", label: "VAT number", group: "Workshop" },
    { key: "bank_details", label: "Banking details", group: "Workshop" },
    { key: "customer_name", label: "Customer full name", group: "Customer" },
    { key: "customer_first_name", label: "Customer first name", group: "Customer" },
    { key: "customer_mobile", label: "Customer mobile", group: "Customer" },
    { key: "account_balance", label: "Account balance", group: "Customer" },
    { key: "vehicle", label: "Vehicle", group: "Vehicle" },
    { key: "plate", label: "Registration", group: "Vehicle" },
    { key: "odometer", label: "Odometer", group: "Vehicle" },
    { key: "next_service_km", label: "Next service (km)", group: "Vehicle" },
    { key: "next_service_date", label: "Next service (date)", group: "Vehicle" },
    { key: "document_title", label: "Document title", group: "Document" },
    { key: "document_number", label: "Document number", group: "Document" },
    { key: "document_date", label: "Document date", group: "Document" },
    { key: "due_date", label: "Due date", group: "Document" },
    { key: "scheduled_at", label: "Booked for", group: "Document" },
    { key: "total", label: "Total", group: "Document" },
    { key: "amount_due", label: "Amount due (blank once settled)", group: "Document" },
    { key: "link", label: "Link to the document", group: "Document" },
];

const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Substitute the fields, and drop any line whose fields all came back empty.
 *
 * That one rule replaces trying to repair grammar around a missing value. A
 * template written for a serviced car should not tell a parts customer "Next
 * service due at  km or ." — so the whole line goes, rather than being patched
 * into something that only looks right for the cases anyone thought to test.
 *
 * A line with some fields filled and some empty is left alone apart from the
 * whitespace and the empty brackets an absent value leaves behind.
 */
export function renderTemplate(body: string, values: MergeValues): string {
    const resolve = (key: string) => {
        const value = values[key.toLowerCase()];
        return value === null || value === undefined ? "" : String(value).trim();
    };

    return body
        .split("\n")
        .map((line) => {
            const used = [...line.matchAll(TOKEN)].map((m) => m[1]);
            if (used.length > 0 && used.every((key) => resolve(key) === "")) return null;
            return line
                .replace(TOKEN, (_match, key: string) => resolve(key))
                .replace(/\(\s*\)/g, "")
                .replace(/[ \t]{2,}/g, " ")
                .trimEnd();
        })
        .filter((line): line is string => line !== null)
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Which fields a template actually uses — for the editor, and for warning about typos. */
export function fieldsUsed(body: string): string[] {
    return [...new Set([...body.matchAll(TOKEN)].map((m) => m[1].toLowerCase()))];
}

export function unknownFields(body: string): string[] {
    const known = new Set(MERGE_FIELDS.map((f) => f.key));
    return fieldsUsed(body).filter((key) => !known.has(key));
}
