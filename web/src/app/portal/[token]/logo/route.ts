import { NextResponse } from "next/server";
import { portalAccess } from "@/lib/portal/data";
import { PORTAL_HEADERS, portalNotFound } from "@/lib/portal/respond";
import { readAttachment } from "@/lib/attachments/service";
import { parseSettings } from "@/lib/settings/schema";

/** The workshop's letterhead logo, and only that: the portal link cannot reach any other file. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const access = await portalAccess(token);
    if (!access.ok) return portalNotFound();
    const logoId = parseSettings(access.tenant.settings).logoAttachmentId;
    const logo = logoId ? await readAttachment(access.db, logoId) : null;
    if (!logo || !logo.mimeType.startsWith("image/")) return portalNotFound();
    return new NextResponse(new Uint8Array(logo.body), {
        headers: { "Content-Type": logo.mimeType, "Content-Length": String(logo.body.byteLength), "X-Content-Type-Options": "nosniff", ...PORTAL_HEADERS },
    });
}
