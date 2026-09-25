import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { businessToday } from "@/lib/tenant/today";
import { letterheadFor } from "@/lib/pdf/data";
import { renderRegisterPdf } from "@/lib/pdf/register";
import { pdfResponse } from "@/lib/pdf/respond";
import { csvPreamble, fileName, type Provenance } from "@/lib/exports/provenance";
import { csvResponse } from "@/lib/exports/respond";
import { recordExport } from "@/lib/exports/record";
import { registerCsv, type Register } from "@/lib/exports/kit";
import {
    AS_AT_REPORTS, BUSINESS_REPORTS, BUSINESS_TITLES, creditorsRegister, customersRegister,
    itemsRegister, labourRegister, profitRegister, quotesRegister, renewalsRegister,
    stockRegister, stocktakeRegister, vehiclesRegister, wipRegister,
    type BusinessReport,
} from "@/lib/exports/business";

/**
 * The owner's exports, one route, for the reasons the audit route is one route:
 * they share a period, a provenance block and an audit record, and writing
 * eleven of those separately is how they come to differ in ways nobody chose.
 *
 * Permission is per report rather than blanket, because these do not all show
 * the same thing. Anything with money on it needs `documents:see_cost`, the
 * supplier ledger follows the payables screen in also wanting
 * `products:write`, and the two listings follow the customer and vehicle
 * screens — which every member can open — with `redactContact` doing the work
 * instead. That last one matters: a mechanic can already page through the
 * customer list, so refusing them the file would be theatre, but the file must
 * strip the addresses exactly as the screen does or the export becomes the way
 * around the permission.
 */

const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const endOf = (s: string) => new Date(`${s}T23:59:59.999Z`);

/** What each report needs on top of `reports:view`. */
const NEEDS: Record<BusinessReport, ("documents:see_cost" | "products:write")[]> = {
    profit: ["documents:see_cost"],
    items: ["documents:see_cost"],
    wip: ["documents:see_cost"],
    quotes: ["documents:see_cost"],
    labour: [],
    creditors: ["documents:see_cost", "products:write"],
    stock: ["documents:see_cost", "products:write"],
    stocktake: ["documents:see_cost", "products:write"],
    renewals: [],
    customers: [],
    vehicles: [],
};

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, user } = await requireTenant(slug);
    if (!can(membership, "reports:view")) return new NextResponse("Not found", { status: 404 });

    const search = new URL(request.url).searchParams;
    const report = search.get("report") as BusinessReport | null;
    if (!report || !BUSINESS_REPORTS.includes(report)) return new NextResponse("Which report?", { status: 400 });
    if (!NEEDS[report].every((p) => can(membership, p))) return new NextResponse("Not found", { status: 404 });

    const format = search.get("format") === "pdf" ? "pdf" : "csv";
    const fromText = valid(search.get("from"));
    const toText = valid(search.get("to"));
    const isAsAt = AS_AT_REPORTS.includes(report);

    // A period report needs both ends. An as-at report is a picture of now,
    // and asking it about last March would be a question with no answer —
    // MOTION does not keep a stock level as at a past date, and inventing one
    // from today's figure would be the most confident kind of wrong.
    const asAt = isAsAt ? (toText ? endOf(toText) : businessToday(tenant.timezone)) : null;
    if (!isAsAt && (!fromText || !toText)) return new NextResponse("Give a from and to date", { status: 400 });

    const from = fromText ? day(fromText) : null;
    const to = toText ? endOf(toText) : null;
    const archived = search.get("archived") === "1";

    let register: Register | null;
    if (report === "profit") register = await profitRegister(db, tenant, from!, to!);
    else if (report === "items") register = await itemsRegister(db, tenant, from!, to!);
    else if (report === "quotes") register = await quotesRegister(db, tenant, from!, to!);
    else if (report === "labour") register = await labourRegister(db, tenant, fromText!, toText!);
    else if (report === "renewals") register = await renewalsRegister(db, tenant, from!, to!, membership);
    else if (report === "wip") register = await wipRegister(db, tenant, asAt!);
    else if (report === "creditors") register = await creditorsRegister(db, tenant, asAt!);
    else if (report === "stock") register = await stockRegister(db, tenant);
    else if (report === "customers") register = await customersRegister(db, tenant, archived, membership);
    else if (report === "vehicles") register = await vehiclesRegister(db, tenant, archived);
    else {
        const takeId = search.get("take");
        if (!takeId) return new NextResponse("Which count?", { status: 400 });
        register = await stocktakeRegister(db, tenant, takeId);
    }
    if (!register) return new NextResponse("Not found", { status: 404 });

    const provenance: Provenance = {
        workshop: tenant.name,
        title: register.title,
        ...(isAsAt ? { asAt: asAt! } : { from: from!, to: to! }),
        generatedAt: new Date(),
        generatedBy: `${user.firstName} ${user.lastName}`.trim() || user.email,
        timezone: tenant.timezone,
        rows: register.rows,
    };

    // Recorded before the file is built, so a download that fails halfway —
    // or one somebody cancels — still leaves the fact that it was asked for.
    await recordExport(db, tenant.id, user.id, {
        report: BUSINESS_TITLES[report],
        format,
        ...(isAsAt ? { to: asAt! } : { from: from!, to: to! }),
        rows: register.rows,
    });

    if (format === "pdf") {
        const body = await renderRegisterPdf({
            workshop: await letterheadFor(db, tenant),
            provenance,
            sections: register.sections,
            totals: register.totals,
            notes: register.notes,
        });
        return pdfResponse(body, fileName(provenance, "pdf"), search.get("download") === "1");
    }

    return csvResponse(`${csvPreamble(provenance, register.notes)}${registerCsv(register)}`, fileName(provenance, "csv"));
}
