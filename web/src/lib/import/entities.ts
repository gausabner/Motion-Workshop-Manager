import { z } from "zod";

/**
 * What can be imported, and what each column means.
 *
 * The aliases matter more than they look: they are what lets a workshop drop
 * the file its old system exported straight in. The Workshop Software names
 * are included because that is the system most of our customers are leaving.
 */

export type FieldSpec = {
    key: string;
    label: string;
    aliases: string[];
    required?: boolean;
    hint?: string;
};

export type EntitySpec = {
    key: ImportEntity;
    label: string;
    blurb: string;
    /** How an incoming row is matched to something already here. */
    matchOn: string;
    fields: FieldSpec[];
};

export type ImportEntity = "customers" | "vehicles" | "products" | "suppliers" | "history" | "bundles" | "serials" | "balances";

const text = (max: number) => z.string().trim().max(max);

export const ENTITIES: Record<ImportEntity, EntitySpec> = {
    customers: {
        key: "customers",
        label: "Customers",
        blurb: "People and businesses. Matched on email, then on name — an existing customer is updated, never duplicated.",
        matchOn: "email, or first and last name",
        fields: [
            { key: "firstName", label: "First name", aliases: ["first name", "firstname", "given name", "contact first name"], required: true },
            { key: "lastName", label: "Last name or company", aliases: ["last name", "lastname", "surname", "company", "company name", "cust company name"], required: true },
            { key: "mobile", label: "Mobile", aliases: ["mobile", "cell", "cellphone", "mobile phone"] },
            { key: "phone", label: "Phone", aliases: ["phone", "telephone", "home phone", "work phone"] },
            { key: "email", label: "Email", aliases: ["email", "email address", "e-mail"] },
            { key: "streetAddress1", label: "Street address", aliases: ["address", "address1", "street", "street address", "cust address1"] },
            { key: "streetSuburb", label: "Suburb", aliases: ["suburb", "cust suburb"] },
            { key: "streetCity", label: "Town or city", aliases: ["city", "town", "cust city"] },
            { key: "streetPostcode", label: "Postcode", aliases: ["postcode", "postal code", "zip", "cust postcode"] },
            { key: "vatNumber", label: "VAT number", aliases: ["vat", "vat number", "tax number", "gst number"] },
            { key: "isBusiness", label: "Is a business", aliases: ["business", "is business", "company account"], hint: "yes/no" },
            { key: "note", label: "Note", aliases: ["note", "notes", "comment"] },
        ],
    },
    vehicles: {
        key: "vehicles",
        label: "Vehicles",
        blurb: "Matched on the registration. The owner is found by the customer columns, so a vehicle never lands without one.",
        matchOn: "registration",
        fields: [
            { key: "plate", label: "Registration", aliases: ["rego", "registration", "plate", "number plate", "reg no"], required: true },
            { key: "customerEmail", label: "Owner's email", aliases: ["customer email", "owner email", "email"], hint: "Used to find the owner" },
            { key: "customerName", label: "Owner's name", aliases: ["customer", "customer name", "owner", "owner name", "account name"], hint: "Used when there is no email" },
            { key: "make", label: "Make", aliases: ["make", "manufacturer"] },
            { key: "model", label: "Model", aliases: ["model"] },
            { key: "year", label: "Year", aliases: ["year", "model year", "build year"] },
            { key: "vin", label: "VIN", aliases: ["vin", "chassis", "chassis number"] },
            { key: "engineNumber", label: "Engine number", aliases: ["engine", "engine number", "engine no"] },
            { key: "colour", label: "Colour", aliases: ["colour", "color"] },
            { key: "odometer", label: "Odometer", aliases: ["odometer", "kms", "km", "mileage", "last odometer"] },
            { key: "licenceExpiry", label: "Licence disc expires", aliases: ["licence expiry", "license expiry", "rego expiry", "rego due", "disc expiry"] },
            { key: "roadworthyExpiry", label: "Roadworthy expires", aliases: ["roadworthy", "roadworthy expiry", "wof expiry", "cof expiry"] },
            { key: "nextServiceDate", label: "Next service due", aliases: ["next service", "next service date", "service due"] },
            { key: "nextServiceKm", label: "Next service at km", aliases: ["next service km", "service due km"] },
        ],
    },
    products: {
        key: "products",
        label: "Products and price file",
        blurb: "Matched on item code. A supplier's price file updates costs and prices without touching stock on hand.",
        matchOn: "item code",
        fields: [
            { key: "itemCode", label: "Item code", aliases: ["code", "item code", "part number", "partno", "sku"], required: true },
            { key: "description", label: "Description", aliases: ["description", "name", "item description"], required: true },
            { key: "costExTax", label: "Cost excluding tax", aliases: ["cost", "cost price", "buy price", "cost ex tax", "unit cost"] },
            { key: "retailPrice", label: "Sell price", aliases: ["price", "sell", "sell price", "retail", "retail price", "rrp"] },
            { key: "type", label: "Type", aliases: ["type", "product type"], hint: "part, labour, sublet, consumable, accessory or tyre" },
            { key: "brand", label: "Brand", aliases: ["brand", "manufacturer"] },
            { key: "location", label: "Shelf", aliases: ["location", "bin", "shelf"] },
            { key: "minQty", label: "Minimum on hand", aliases: ["min", "minimum", "reorder level", "min qty"] },
            { key: "barcodeIgnored", label: "Barcode (ignored)", aliases: ["barcode", "ean"], hint: "Read but not stored yet" },
        ],
    },
    suppliers: {
        key: "suppliers",
        label: "Suppliers",
        blurb: "Matched on the supplier's name.",
        matchOn: "supplier name",
        fields: [
            { key: "companyName", label: "Supplier name", aliases: ["supplier", "name", "company", "company name", "vendor"], required: true },
            { key: "accountNumber", label: "Our account number", aliases: ["account", "account number", "account no"] },
            { key: "phone", label: "Phone", aliases: ["phone", "telephone"] },
            { key: "email", label: "Email", aliases: ["email", "email address"] },
            { key: "city", label: "Town or city", aliases: ["city", "town"] },
            { key: "paymentTermsDays", label: "Payment terms (days)", aliases: ["terms", "payment terms", "days"] },
        ],
    },
    history: {
        key: "history",
        label: "Vehicle service history",
        blurb: "What was done to each car before you switched. Kept out of your sales figures — it was invoiced by the old system, not by you.",
        matchOn: "registration and date",
        fields: [
            { key: "plate", label: "Registration", aliases: ["rego", "registration", "plate", "vehicle"], required: true },
            { key: "date", label: "Date", aliases: ["date", "invoice date", "service date", "job date"], required: true },
            { key: "description", label: "What was done", aliases: ["description", "work done", "details", "notes", "job description"], required: true },
            { key: "reference", label: "Their job or invoice number", aliases: ["invoice", "invoice number", "job", "job number", "reference", "doc number"] },
            { key: "odometer", label: "Odometer", aliases: ["odometer", "kms", "km", "mileage"] },
            { key: "total", label: "Total charged", aliases: ["total", "amount", "invoice total", "value"], hint: "Recorded for reference only" },
        ],
    },
    bundles: {
        key: "bundles",
        label: "Bundles and their contents",
        blurb: "One row per component: the bundle's code, then the product inside it and how many. Both must already exist as products.",
        matchOn: "bundle code and component code",
        fields: [
            { key: "bundleCode", label: "Bundle item code", aliases: ["bundle", "bundle code", "parent", "parent code", "kit code"], required: true },
            { key: "componentCode", label: "Component item code", aliases: ["component", "component code", "child", "child code", "item code", "part number"], required: true },
            { key: "quantity", label: "Quantity in the bundle", aliases: ["quantity", "qty", "each"], hint: "Defaults to 1" },
        ],
    },
    serials: {
        key: "serials",
        label: "Serial numbers",
        blurb: "Units on the shelf now, or already sold. Matched on the serial for that product.",
        matchOn: "product and serial",
        fields: [
            { key: "itemCode", label: "Item code", aliases: ["code", "item code", "part number", "product"], required: true },
            { key: "serial", label: "Serial number", aliases: ["serial", "serial number", "serialno", "imei"], required: true },
            { key: "state", label: "Where it is", aliases: ["status", "state", "sold"], hint: "in stock, sold or written off — defaults to in stock" },
            { key: "unitCost", label: "What it cost", aliases: ["cost", "cost price", "unit cost"] },
            { key: "soldDate", label: "Date sold", aliases: ["sold", "date sold", "sold date", "invoice date"] },
        ],
    },
    balances: {
        key: "balances",
        label: "Customer opening balances",
        blurb: "What each customer still owed you on the day you switched, as one invoice per customer — so \u201cwho owes us\u201d is right from the first morning.",
        matchOn: "customer, once only",
        fields: [
            { key: "customerEmail", label: "Customer email", aliases: ["email", "customer email"], hint: "Used to find the customer" },
            { key: "customerName", label: "Customer name", aliases: ["customer", "customer name", "account", "account name"], hint: "Used when there is no email" },
            { key: "amount", label: "Amount owing", aliases: ["balance", "amount", "owing", "outstanding", "total"], required: true },
            { key: "date", label: "As at", aliases: ["date", "as at", "as at date", "statement date"], hint: "Defaults to today" },
            { key: "dueDate", label: "Due date", aliases: ["due", "due date"] },
            { key: "reference", label: "Their reference", aliases: ["reference", "invoice", "invoice number", "notes"] },
        ],
    },
};

export const ENTITY_LIST = Object.values(ENTITIES);

/** A date as any of the ways a workshop's old system might have written it. */
export function parseDate(value: string): { ok: true; value: Date | null } | { ok: false } {
    const raw = value.trim();
    if (!raw) return { ok: true, value: null };
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (iso) return { ok: true, value: new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`) };
    // 31/01/2026 and 31-01-2026, day first: the local convention, and what every export here uses.
    const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(raw);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        const year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCMonth() !== month - 1) return { ok: false };
        return { ok: true, value: date };
    }
    return { ok: false };
}

/** A number as typed: thousands separators, currency symbols and blanks allowed. */
export function parseNumber(value: string): { ok: true; value: number | null } | { ok: false } {
    const raw = value.trim().replace(/[R$\s]|N\$/g, "").replace(/,(?=\d{3}\b)/g, "");
    if (!raw) return { ok: true, value: null };
    const cleaned = raw.replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

/** "Yes", "Y", "true", "1" — anything else is no. */
export function parseBoolean(value: string): boolean {
    return /^(y|yes|true|1)$/i.test(value.trim());
}

export const nameSchema = text(120);
