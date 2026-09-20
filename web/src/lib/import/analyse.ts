import { ENTITIES, parseBoolean, parseDate, parseNumber, type ImportEntity } from "@/lib/import/entities";
import type { Row } from "@/lib/import/csv";

/**
 * Reading a file before importing it: what each row would do, and what is
 * wrong with the ones that cannot be used.
 *
 * The rule throughout is that a bad row is reported and skipped, never
 * allowed to stop the rest. A workshop's twenty-year-old customer list always
 * has a few rows nobody can save, and refusing the whole file over them is
 * how an import gets abandoned.
 */

export type RowProblem = { line: number; message: string };
export type ParsedRow = { line: number; values: Record<string, string | number | boolean | Date | null> };

export type Analysis = {
    entity: ImportEntity;
    total: number;
    ready: ParsedRow[];
    problems: RowProblem[];
    /** Columns in the file that are not mapped to anything, so nothing is silently dropped. */
    ignoredColumns: string[];
    missingRequired: string[];
};

const DATE_FIELDS = new Set(["licenceExpiry", "roadworthyExpiry", "nextServiceDate", "date", "dueDate", "soldDate"]);
const NUMBER_FIELDS = new Set(["year", "odometer", "nextServiceKm", "costExTax", "retailPrice", "minQty", "paymentTermsDays", "total", "quantity", "unitCost", "amount"]);
const BOOLEAN_FIELDS = new Set(["isBusiness"]);

export function analyse(entity: ImportEntity, headers: string[], rows: Row[], mapping: Record<string, string>): Analysis {
    const spec = ENTITIES[entity];
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    const missingRequired = spec.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);

    const ready: ParsedRow[] = [];
    const problems: RowProblem[] = [];

    rows.forEach((row, index) => {
        // Line 1 is the header, so the first row of data is line 2 — which is what the workshop sees in Excel.
        const line = index + 2;
        const values: ParsedRow["values"] = {};
        const rowProblems: string[] = [];

        for (const field of spec.fields) {
            const column = mapping[field.key];
            const raw = column ? (row[column] ?? "").trim() : "";
            if (!raw) {
                if (field.required) rowProblems.push(`${field.label} is empty`);
                values[field.key] = null;
                continue;
            }
            if (DATE_FIELDS.has(field.key)) {
                const parsed = parseDate(raw);
                if (!parsed.ok) rowProblems.push(`${field.label} "${raw}" is not a date`);
                else values[field.key] = parsed.value;
                continue;
            }
            if (NUMBER_FIELDS.has(field.key)) {
                const parsed = parseNumber(raw);
                if (!parsed.ok) rowProblems.push(`${field.label} "${raw}" is not a number`);
                else values[field.key] = parsed.value;
                continue;
            }
            if (BOOLEAN_FIELDS.has(field.key)) {
                values[field.key] = parseBoolean(raw);
                continue;
            }
            values[field.key] = raw.slice(0, 200);
        }

        if (entity === "vehicles" && !values.customerEmail && !values.customerName) {
            rowProblems.push("No owner: give an email or a customer name");
        }
        if (entity === "balances") {
            if (!values.customerEmail && !values.customerName) rowProblems.push("No customer: give an email or a name");
            const amount = Number(values.amount ?? 0);
            if (!amount) rowProblems.push("An opening balance of nothing is not worth importing");
            else if (amount < 0) rowProblems.push("A negative balance is money you owe them — bring that across as a credit note instead");
        }
        if (rowProblems.length > 0) problems.push({ line, message: rowProblems.join("; ") });
        else ready.push({ line, values });
    });

    return {
        entity,
        total: rows.length,
        ready,
        problems,
        ignoredColumns: headers.filter((h) => !mapped.has(h)),
        missingRequired,
    };
}

/** Rows that would collide with each other inside the same file. */
export function duplicatesWithin(entity: ImportEntity, rows: ParsedRow[]): RowProblem[] {
    const keyOf = (values: ParsedRow["values"]): string | null => {
        if (entity === "serials") return `${String(values.itemCode ?? "")}|${String(values.serial ?? "")}`.toLowerCase();
        if (entity === "bundles") return `${String(values.bundleCode ?? "")}|${String(values.componentCode ?? "")}`.toLowerCase();
        // History rows repeat by their nature — the same car, serviced many times — so nothing is a duplicate.
        if (entity === "history") return null;
        if (entity === "balances") return String(values.customerEmail ?? values.customerName ?? "").toLowerCase() || null;
        if (entity === "products") return String(values.itemCode ?? "").toLowerCase() || null;
        if (entity === "vehicles") return String(values.plate ?? "").toLowerCase().replace(/\s/g, "") || null;
        if (entity === "suppliers") return String(values.companyName ?? "").toLowerCase() || null;
        const email = String(values.email ?? "").toLowerCase();
        return email || `${String(values.firstName ?? "")} ${String(values.lastName ?? "")}`.toLowerCase().trim() || null;
    };
    const seen = new Map<string, number>();
    const out: RowProblem[] = [];
    for (const row of rows) {
        const key = keyOf(row.values);
        if (!key) continue;
        const first = seen.get(key);
        if (first !== undefined) out.push({ line: row.line, message: `The same record appears on line ${first} as well; the last one wins.` });
        else seen.set(key, row.line);
    }
    return out;
}
