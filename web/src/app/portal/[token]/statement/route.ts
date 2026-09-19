import { NextResponse } from "next/server";
import { portalAccess } from "@/lib/portal/data";
import { PORTAL_HEADERS, portalNotFound } from "@/lib/portal/respond";
import { statementPdfInput } from "@/lib/pdf/data";
import { renderStatementPdf } from "@/lib/pdf/statement";
import { businessToday } from "@/lib/tenant/today";

/** The customer's statement for the last six months. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const access = await portalAccess(token);
    if (!access.ok || !access.settings.sections.account) return portalNotFound();
    const to = businessToday(access.tenant.timezone);
    const from = new Date(to.getTime() - 182 * 86_400_000);
    const input = await statementPdfInput(access.db, access.tenant, access.customer.id, from, to);
    if (!input) return portalNotFound();
    const body = await renderStatementPdf(input);
    return new NextResponse(new Uint8Array(body), {
        headers: { "Content-Type": "application/pdf", "Content-Length": String(body.byteLength), "Content-Disposition": `inline; filename="statement.pdf"`, ...PORTAL_HEADERS },
    });
}
