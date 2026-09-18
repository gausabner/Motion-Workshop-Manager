import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { readAttachment } from "@/lib/attachments/service";
import { safeFileName } from "@/lib/storage";

/**
 * Attachments are served through the app, never from a public URL.
 *
 * A proof of payment carries a customer's bank details, so every read goes
 * through the session and the tenant-scoped client: a signed-in user of one
 * workshop asking for another workshop's file gets a 404, the same answer as
 * a file that does not exist.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db } = await requireTenant(slug);

    const attachment = await readAttachment(db, id);
    if (!attachment) return new NextResponse("Not found", { status: 404 });

    return new NextResponse(new Uint8Array(attachment.body), {
        headers: {
            "Content-Type": attachment.mimeType,
            "Content-Length": String(attachment.body.byteLength),
            // `inline` so a PDF or photo opens in the tab; the name is still sanitised.
            "Content-Disposition": `inline; filename="${safeFileName(attachment.fileName)}"`,
            "Cache-Control": "private, max-age=0, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
