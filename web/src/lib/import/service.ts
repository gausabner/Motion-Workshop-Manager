import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import type { ImportEntity } from "@/lib/import/entities";
import type { ParsedRow, RowProblem } from "@/lib/import/analyse";

/**
 * Writing an import. Every entity matches an incoming row against what is
 * already here and updates it rather than making a second copy — a workshop
 * importing its customer list twice must end with one list, not two.
 *
 * Rows are written one at a time, and a row that fails is recorded and
 * stepped over: a file of two thousand is not worth abandoning over three.
 */

export type ImportResult = { created: number; updated: number; skipped: number; problems: RowProblem[] };

const str = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
};
const numberOf = (v: unknown): number | null => (typeof v === "number" ? v : null);
const intOf = (v: unknown): number | null => (typeof v === "number" ? Math.round(v) : null);
const dateOf = (v: unknown): Date | null => (v instanceof Date ? v : null);

export async function runImport(db: TenantDb, tenant: Tenant, entity: ImportEntity, rows: ParsedRow[]): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, problems: [] };
    for (const row of rows) {
        try {
            const outcome = await db.$transaction((tx) => writeRow(tx, tenant, entity, row));
            if (outcome === "created") result.created++;
            else result.updated++;
        } catch (error) {
            result.skipped++;
            result.problems.push({ line: row.line, message: error instanceof Error ? error.message : "Could not be saved" });
        }
    }
    return result;
}

async function writeRow(tx: TenantTx, tenant: Tenant, entity: ImportEntity, row: ParsedRow): Promise<"created" | "updated"> {
    const v = row.values;
    if (entity === "customers") {
        const email = str(v.email)?.toLowerCase() ?? null;
        const firstName = str(v.firstName) ?? "";
        const lastName = str(v.lastName) ?? "";
        const existing = email
            ? await tx.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })
            : await tx.customer.findFirst({ where: { firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } }, select: { id: true } });
        const data = {
            firstName, lastName, email, mobile: str(v.mobile), phone: str(v.phone),
            streetAddress1: str(v.streetAddress1), streetSuburb: str(v.streetSuburb), streetCity: str(v.streetCity), streetPostcode: str(v.streetPostcode),
            vatNumber: str(v.vatNumber), isBusiness: v.isBusiness === true, note: str(v.note),
        };
        if (existing) {
            await tx.customer.update({ where: { id: existing.id }, data });
            return "updated";
        }
        await tx.customer.create({ data: { ...data, tenantId: tenant.id } });
        return "created";
    }

    if (entity === "suppliers") {
        const companyName = str(v.companyName) ?? "";
        const existing = await tx.supplier.findFirst({ where: { companyName: { equals: companyName, mode: "insensitive" } }, select: { id: true } });
        const data = {
            companyName, accountNumber: str(v.accountNumber), phone: str(v.phone), email: str(v.email),
            city: str(v.city), paymentTermsDays: intOf(v.paymentTermsDays),
        };
        if (existing) {
            await tx.supplier.update({ where: { id: existing.id }, data });
            return "updated";
        }
        await tx.supplier.create({ data: { ...data, tenantId: tenant.id } });
        return "created";
    }

    if (entity === "products") {
        const itemCode = str(v.itemCode) ?? "";
        const existing = await tx.product.findFirst({ where: { itemCode: { equals: itemCode, mode: "insensitive" } }, select: { id: true } });
        const type = productType(str(v.type));
        const data = {
            itemCode, description: str(v.description) ?? itemCode,
            ...(numberOf(v.costExTax) !== null ? { costExTax: numberOf(v.costExTax)! } : {}),
            ...(numberOf(v.retailPrice) !== null ? { retailPrice: numberOf(v.retailPrice)! } : {}),
            ...(numberOf(v.minQty) !== null ? { minQty: numberOf(v.minQty)! } : {}),
            ...(type ? { type } : {}),
            brand: str(v.brand), location: str(v.location),
        };
        if (existing) {
            // Stock on hand is never touched by an import: it belongs to the ledger.
            await tx.product.update({ where: { id: existing.id }, data });
            return "updated";
        }
        await tx.product.create({ data: { ...data, tenantId: tenant.id, type: type ?? "STOCK" } });
        return "created";
    }

    // Vehicles: find the owner first, since a vehicle without one is not worth having.
    const plate = (str(v.plate) ?? "").toUpperCase();
    const email = str(v.customerEmail)?.toLowerCase() ?? null;
    const name = str(v.customerName);
    let customer = email ? await tx.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } }) : null;
    if (!customer && name) {
        const [first, ...rest] = name.split(/\s+/);
        const last = rest.join(" ");
        customer = await tx.customer.findFirst({
            where: last
                ? { firstName: { equals: first, mode: "insensitive" }, lastName: { equals: last, mode: "insensitive" } }
                : { lastName: { equals: name, mode: "insensitive" } },
            select: { id: true },
        });
        if (!customer) {
            // A name with nobody behind it becomes a customer: the vehicle history is the point of the import.
            customer = await tx.customer.create({
                data: { tenantId: tenant.id, firstName: last ? first : "", lastName: last || name, email },
                select: { id: true },
            });
        }
    }
    if (!customer) throw new Error(`No customer found for "${email ?? name ?? "unknown"}"`);

    const data = {
        plate, customerId: customer.id, make: str(v.make) ?? "", model: str(v.model) ?? "",
        year: intOf(v.year), vin: str(v.vin), engineNumber: str(v.engineNumber), colour: str(v.colour),
        odometer: intOf(v.odometer), licenceExpiry: dateOf(v.licenceExpiry), roadworthyExpiry: dateOf(v.roadworthyExpiry),
        nextServiceDate: dateOf(v.nextServiceDate), nextServiceKm: intOf(v.nextServiceKm),
    };
    const existing = await tx.vehicle.findFirst({ where: { plate: { equals: plate, mode: "insensitive" } }, select: { id: true } });
    if (existing) {
        await tx.vehicle.update({ where: { id: existing.id }, data });
        return "updated";
    }
    await tx.vehicle.create({ data: { ...data, tenantId: tenant.id } });
    return "created";
}

/** "Part", "labour", "Stock Item" — whatever the old system called it. */
function productType(value: string | null): "STOCK" | "LABOUR" | "SUBLET" | "CONSUMABLE" | "ACCESSORY" | "TYRE" | null {
    if (!value) return null;
    const v = value.toLowerCase();
    if (v.includes("labour") || v.includes("labor")) return "LABOUR";
    if (v.includes("sublet")) return "SUBLET";
    if (v.includes("consum")) return "CONSUMABLE";
    if (v.includes("access")) return "ACCESSORY";
    if (v.includes("tyre") || v.includes("tire")) return "TYRE";
    if (v.includes("part") || v.includes("stock")) return "STOCK";
    return null;
}
