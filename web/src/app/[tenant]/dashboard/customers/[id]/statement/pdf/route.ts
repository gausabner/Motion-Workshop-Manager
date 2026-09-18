import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { statementPdfInput } from "@/lib/pdf/data";
import { renderStatementPdf } from "@/lib/pdf/statement";
import { pdfResponse } from "@/lib/pdf/respond";
import { businessToday } from "@/lib/tenant/today";

const DAY = 86_400_000;
const parseDate = (value: string | null, fallback: Date) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : fallback;

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant } = await requireTenant(slug);
    const search = new URL(request.url).searchParams;

    const to = parseDate(search.get("to"), businessToday(tenant.timezone));
    const from = parseDate(search.get("from"), new Date(to.getTime() - 90 * DAY));

    const input = await statementPdfInput(db, tenant, id, from, to);
    if (!input) return new NextResponse("Not found", { status: 404 });

    const body = await renderStatementPdf(input);
    return pdfResponse(body, `statement-${input.customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf`, search.get("download") === "1");
}
