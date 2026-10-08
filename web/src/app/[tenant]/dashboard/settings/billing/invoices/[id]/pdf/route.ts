import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { renderSubscriptionInvoicePdf } from "@/lib/pdf/subscription-invoice";
import { pdfResponse } from "@/lib/pdf/respond";

/**
 * A workshop's own tax invoice from MOTION. For the people who can see what
 * the workshop pays — the same rule as the Billing page — and read through the
 * workshop's scoped client, so another workshop's invoice is simply not found.
 */
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) return new NextResponse("Not found", { status: 404 });

    const invoice = await db.subscriptionInvoice.findUnique({ where: { id } });
    if (!invoice) return new NextResponse("Not found", { status: 404 });
    const body = await renderSubscriptionInvoicePdf(invoice);
    return pdfResponse(body, `${invoice.number}.pdf`, new URL(request.url).searchParams.get("download") === "1");
}
