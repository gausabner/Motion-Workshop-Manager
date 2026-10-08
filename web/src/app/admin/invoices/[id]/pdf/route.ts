import { NextResponse } from "next/server";
import { asStaff } from "@/lib/admin/platform";
import { renderSubscriptionInvoicePdf } from "@/lib/pdf/subscription-invoice";
import { pdfResponse } from "@/lib/pdf/respond";

/** Any workshop's tax invoice, for MOTION's staff. Staff-checked by `asStaff`, which 404s everybody else. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const invoice = await asStaff((tx) => tx.subscriptionInvoice.findUnique({ where: { id } }));
    if (!invoice) return new NextResponse("Not found", { status: 404 });
    const body = await renderSubscriptionInvoicePdf(invoice);
    return pdfResponse(body, `${invoice.number}.pdf`, new URL(request.url).searchParams.get("download") === "1");
}
