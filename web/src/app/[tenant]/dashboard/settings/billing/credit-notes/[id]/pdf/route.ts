import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { renderSubscriptionCreditNotePdf } from "@/lib/pdf/subscription-invoice";
import { pdfResponse } from "@/lib/pdf/respond";

/** A workshop's own credit note from MOTION — the same people and the same rule as its invoices. */
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) return new NextResponse("Not found", { status: 404 });

    const note = await db.subscriptionCreditNote.findUnique({ where: { id } });
    if (!note) return new NextResponse("Not found", { status: 404 });
    const invoice = await db.subscriptionInvoice.findUnique({ where: { id: note.invoiceId }, select: { number: true, issuedAt: true } });
    if (!invoice) return new NextResponse("Not found", { status: 404 });
    const body = await renderSubscriptionCreditNotePdf(note, invoice);
    return pdfResponse(body, `${note.number}.pdf`, new URL(request.url).searchParams.get("download") === "1");
}
