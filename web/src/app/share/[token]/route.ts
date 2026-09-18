import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { recordOpen, resolveShareToken } from "@/lib/sharing/links";
import { documentPdfInput, receiptPdfInput, statementPdfInput } from "@/lib/pdf/data";
import { renderDocumentPdf } from "@/lib/pdf/documents";
import { renderReceiptPdf } from "@/lib/pdf/receipt";
import { renderStatementPdf } from "@/lib/pdf/statement";
import { safeFileName } from "@/lib/storage";

/**
 * What a customer lands on when they tap the link in a WhatsApp message.
 *
 * No session, no login: the token is the credential. It is resolved to a
 * tenant first, and every read after that goes through the tenant-scoped
 * client, so a token can only ever reach the one thing it was minted for.
 *
 * The document is rendered live rather than frozen at send time — if an
 * invoice is voided after it went out, the customer sees that it was voided,
 * which is the truth they need.
 */

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "Cache-Control": "private, no-store" };

const REASONS = {
    unknown: "This link is not valid. It may have been copied incompletely.",
    expired: "This link has expired. Ask the workshop to send it again.",
    revoked: "This link has been withdrawn by the workshop.",
    missing: "The document this link pointed to is no longer available.",
} as const;

function unavailable(reason: keyof typeof REASONS, status = 404): NextResponse {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable</title>
<style>body{margin:0;font:15px/1.5 system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
main{max-width:420px;background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:28px}h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#475569}</style></head>
<body><main><h1>Link unavailable</h1><p>${REASONS[reason]}</p></main></body></html>`;
    return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...NOINDEX } });
}

const parseDate = (value: string | undefined, fallback: Date) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : fallback;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const share = await resolveShareToken(token);
    if (!share.ok) return unavailable(share.reason, share.reason === "unknown" ? 404 : 410);

    const tenant = await prisma.tenant.findUnique({ where: { id: share.tenantId } });
    if (!tenant?.isActive) return unavailable("missing");
    const db = forTenant(tenant.id);

    let body: Buffer | null = null;
    let name = "document.pdf";
    if (share.kind === "DOCUMENT") {
        const input = await documentPdfInput(db, tenant, share.targetId);
        if (input) {
            body = await renderDocumentPdf(input);
            name = `${input.type.toLowerCase().replace("_", "-")}-${input.number ?? input.jobNumber ?? "draft"}.pdf`;
        }
    } else if (share.kind === "PAYMENT") {
        const input = await receiptPdfInput(db, tenant, share.targetId);
        if (input) {
            body = await renderReceiptPdf(input);
            name = `${input.direction.toLowerCase()}-${input.number ?? ""}.pdf`;
        }
    } else {
        const to = parseDate(share.params.to, new Date());
        const from = parseDate(share.params.from, new Date(to.getTime() - 90 * 86_400_000));
        const input = await statementPdfInput(db, tenant, share.targetId, from, to);
        if (input) {
            body = await renderStatementPdf(input);
            name = `statement-${tenant.name}.pdf`;
        }
    }
    if (!body) return unavailable("missing");

    // Counted only once there is something to show, so a dead link is not reported as opened.
    await recordOpen(share.id);

    return new NextResponse(new Uint8Array(body), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(body.byteLength),
            "Content-Disposition": `inline; filename="${safeFileName(name.replace(/\s+/g, "-").toLowerCase(), "document.pdf")}"`,
            ...NOINDEX,
        },
    });
}
