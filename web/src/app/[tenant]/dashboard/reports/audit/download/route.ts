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
import {
    cashbookRegister, debtorsRegister, registerCsv, REPORTS, REPORT_TITLES,
    salesRegister, sequenceRegister, transactionsRegister, vatRegister,
    type Register, type ReportName,
} from "@/lib/exports/registers";

/**
 * The six audit exports, one route.
 *
 * They share a period, a permission, a provenance block and an audit record,
 * and the only thing that differs between them is which query runs — so six
 * routes would be five copies of the same twenty lines, differing in ways
 * nobody intended.
 *
 * Permission follows the screen exactly: `reports:view` to see the reports at
 * all, and `documents:see_cost` for anything with money on it. There is no new
 * permission for downloading, because a file of what you can already read on
 * screen is not a new capability — and inventing one would mean a workshop
 * that grants "view reports" without "export reports" believes it has stopped
 * something it has not.
 */

const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const endOf = (s: string) => new Date(`${s}T23:59:59.999Z`);

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, user } = await requireTenant(slug);
    if (!can(membership, "reports:view")) return new NextResponse("Not found", { status: 404 });

    const search = new URL(request.url).searchParams;
    const report = search.get("report") as ReportName | null;
    if (!report || !REPORTS.includes(report)) return new NextResponse("Which report?", { status: 400 });

    // Every one of these puts money or contact details on a page.
    if (!can(membership, "documents:see_cost")) return new NextResponse("Not found", { status: 404 });

    const format = search.get("format") === "pdf" ? "pdf" : "csv";
    const fromText = valid(search.get("from"));
    const toText = valid(search.get("to"));

    // The debtors list is an as-at report rather than a period: what is owed
    // today, not what happened last month. Asking it for a period would be a
    // question with no answer.
    const asAt = report === "debtors" ? (toText ? endOf(toText) : businessToday(tenant.timezone)) : null;
    if (!asAt && (!fromText || !toText)) return new NextResponse("Give a from and to date", { status: 400 });

    const from = fromText ? day(fromText) : null;
    const to = toText ? endOf(toText) : null;

    let register: Register;
    if (report === "transactions") {
        register = await transactionsRegister(db, tenant, from!, to!, search.get("actor") ?? undefined);
    } else if (report === "sequence") {
        register = await sequenceRegister(db, tenant, from!, to!);
    } else if (report === "sales") {
        register = await salesRegister(db, tenant, from!, to!);
    } else if (report === "vat") {
        register = await vatRegister(db, tenant, from!, to!);
    } else if (report === "cashbook") {
        register = await cashbookRegister(db, tenant, from!, to!);
    } else {
        register = await debtorsRegister(db, tenant, asAt!);
    }

    const provenance: Provenance = {
        workshop: tenant.name,
        title: register.title,
        ...(asAt ? { asAt } : { from: from!, to: to! }),
        generatedAt: new Date(),
        generatedBy: `${user.firstName} ${user.lastName}`.trim() || user.email,
        timezone: tenant.timezone,
        rows: register.rows,
    };

    // Recorded before the file is built, so a download that fails halfway —
    // or one somebody cancels — still leaves the fact that it was asked for.
    await recordExport(db, tenant.id, user.id, {
        report: REPORT_TITLES[report],
        format,
        ...(asAt ? { to: asAt } : { from: from!, to: to! }),
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

    return csvResponse(`${csvPreamble(provenance)}${registerCsv(register)}`, fileName(provenance, "csv"));
}
