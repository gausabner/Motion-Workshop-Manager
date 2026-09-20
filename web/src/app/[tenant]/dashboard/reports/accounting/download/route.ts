import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportFileName, journalCsv, plainMoney, plainSales, salesJournal, xeroSales, type ExportKind, type ExportFormat } from "@/lib/accounting/export";
import { purchasesFor, receiptsFor, salesFor, supplierPaymentsFor } from "@/lib/accounting/queries";
import { accountingSettings } from "@/lib/settings/schema";

const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/** The period as a CSV file, in whichever shape the bookkeeper asked for. */
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view") || !can(membership, "documents:see_cost")) return new NextResponse("Not found", { status: 404 });

    const search = new URL(request.url).searchParams;
    const from = valid(search.get("from"));
    const to = valid(search.get("to"));
    if (!from || !to) return new NextResponse("Give a from and to date", { status: 400 });
    const kind = (search.get("kind") ?? "sales") as ExportKind;
    const format = (search.get("format") ?? "plain") as ExportFormat;
    const accounts = accountingSettings(tenant.settings);

    let csv: string;
    if (kind === "sales") {
        const rows = await salesFor(db, day(from), day(to));
        csv = format === "xero" ? xeroSales(rows, { salesAccount: accounts.salesAccount, taxType: accounts.salesTaxType })
            : format === "journal" ? journalCsv(salesJournal(rows, accounts), tenant.currency)
            : plainSales(rows, tenant.currency);
    } else if (kind === "purchases") {
        const rows = await purchasesFor(db, day(from), day(to));
        csv = plainSales(rows, tenant.currency);
    } else if (kind === "receipts") {
        csv = plainMoney(await receiptsFor(db, day(from), day(to)), tenant.currency, "Customer");
    } else {
        csv = plainMoney(await supplierPaymentsFor(db, day(from), day(to)), tenant.currency, "Supplier");
    }

    return new NextResponse(csv, {
        headers: {
            // A BOM, so Excel opens it as UTF-8 rather than mangling the first heading.
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${exportFileName(tenant.name, kind, from, to)}"`,
            "Cache-Control": "private, no-store",
        },
    });
}
