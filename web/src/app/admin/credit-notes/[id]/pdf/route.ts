import { NextResponse } from "next/server";
import { asStaff } from "@/lib/admin/platform";
import { renderSubscriptionCreditNotePdf } from "@/lib/pdf/subscription-invoice";
import { pdfResponse } from "@/lib/pdf/respond";

/** Any workshop's credit note, for MOTION's staff. `asStaff` 404s everybody else. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const note = await asStaff((tx) =>
        tx.subscriptionCreditNote.findUnique({ where: { id }, include: { invoice: { select: { number: true, issuedAt: true } } } }),
    );
    if (!note) return new NextResponse("Not found", { status: 404 });
    const body = await renderSubscriptionCreditNotePdf(note, note.invoice);
    return pdfResponse(body, `${note.number}.pdf`, new URL(request.url).searchParams.get("download") === "1");
}
