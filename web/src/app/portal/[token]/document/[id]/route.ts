import { NextResponse } from "next/server";
import { portalAccess, portalDocument } from "@/lib/portal/data";
import { PORTAL_HEADERS, portalNotFound } from "@/lib/portal/respond";
import { documentPdfInput } from "@/lib/pdf/data";
import { renderDocumentPdf } from "@/lib/pdf/documents";
import { safeFileName } from "@/lib/storage";

/** One of the customer's own invoices or sent quotes, as a PDF. Anything else answers 404. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
    const { token, id } = await params;
    const access = await portalAccess(token);
    if (!access.ok) return portalNotFound();
    const doc = await portalDocument(access.db, access.customer.id, access.settings, id);
    if (!doc) return portalNotFound();
    const input = await documentPdfInput(access.db, access.tenant, doc.id);
    if (!input) return portalNotFound();
    const body = await renderDocumentPdf(input);
    const name = `${input.type.toLowerCase().replace("_", "-")}-${input.number ?? "document"}.pdf`;
    return new NextResponse(new Uint8Array(body), {
        headers: { "Content-Type": "application/pdf", "Content-Length": String(body.byteLength), "Content-Disposition": `inline; filename="${safeFileName(name, "document.pdf")}"`, ...PORTAL_HEADERS },
    });
}
