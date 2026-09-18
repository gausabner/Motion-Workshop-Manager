import { NextResponse } from "next/server";
import { inspectionForToken } from "@/lib/inspections/public";
import { readAttachment } from "@/lib/attachments/service";

/** A finding's photo, for the customer. Only photos on this inspection's findings are reachable through this link. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; attachmentId: string }> }) {
    const { token, attachmentId } = await params;
    const found = await inspectionForToken(token);
    if (!found.ok) return new NextResponse("Not found", { status: 404 });
    const owned = found.inspection.items.some((i) => i.photos.some((p) => p.id === attachmentId));
    if (!owned) return new NextResponse("Not found", { status: 404 });
    const photo = await readAttachment(found.db, attachmentId);
    if (!photo) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(photo.body), {
        headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
    });
}
