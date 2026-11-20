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

    // A request for quotation is read in the supplier's browser, not printed: it is a page, not a PDF.
    if (share.kind === "QUOTATION_REQUEST") {
        const html = await quotationRequestPage(db, tenant, share.targetId, share.params.supplierId);
        if (!html) return unavailable("missing");
        await recordOpen(share.id);
        return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...NOINDEX } });
    }

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
    } else if (share.kind === "STATEMENT") {
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

const esc = (value: string | null | undefined) =>
    (value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The request a supplier opens: who is asking, for what, how many, by when,
 * and how to answer. No prices: the council's estimates are its own, and a
 * supplier who saw them would quote to them.
 */
async function quotationRequestPage(db: ReturnType<typeof forTenant>, tenant: { name: string; email: string | null; phone: string | null; address1: string | null; city: string | null }, requisitionId: string, supplierId: string | undefined): Promise<string | null> {
    const [req, supplier] = await Promise.all([
        db.requisition.findUnique({
            where: { id: requisitionId },
            select: { number: true, kind: true, state: true, requiredBy: true, lines: { orderBy: { sortOrder: "asc" }, select: { itemCode: true, description: true, quantity: true } } },
        }),
        supplierId ? db.supplier.findUnique({ where: { id: supplierId }, select: { companyName: true } }) : null,
    ]);
    if (!req || req.kind !== "PURCHASE") return null;
    const closed = req.state === "CANCELLED" || req.state === "REJECTED" || req.state === "CLOSED";
    const needed = req.requiredBy ? req.requiredBy.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }) : null;
    const contact = [tenant.email, tenant.phone].filter(Boolean).map(esc).join(" · ");
    const rows = req.lines
        .map((l) => `<tr><td class="code">${esc(l.itemCode)}</td><td>${esc(l.description)}</td><td class="num">${l.quantity.toNumber()}</td></tr>`)
        .join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Request for quotation ${esc(req.number)}</title>
<style>
:root{color-scheme:light}
body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
main{max-width:720px;margin:0 auto;padding:32px 16px 48px}
.sheet{background:#fff;border:1px solid #e2e8f0;padding:24px}
.label{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#64748b;margin:0}
h1{font-size:20px;margin:4px 0 2px}
p{margin:0}
.muted{color:#475569}
table{width:100%;border-collapse:collapse;margin:20px 0 8px;font-variant-numeric:tabular-nums}
th{font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#64748b;text-align:left;padding:6px 8px 6px 0;border-bottom:1px solid #e2e8f0}
td{padding:8px 8px 8px 0;border-bottom:1px solid #f1f5f9;vertical-align:top}
.num{text-align:right;padding-right:0}.code{color:#475569;white-space:nowrap;font-size:13px}
.answer{margin-top:20px;padding:12px 16px;border:1px solid #e2e8f0;border-left:1px solid #0f766e;position:relative}
.closed{border-left-color:#b45309}
</style></head><body><main><div class="sheet">
<p class="label">Request for quotation</p>
<h1>${esc(tenant.name)} · ${esc(req.number)}</h1>
<p class="muted">${supplier ? `For ${esc(supplier.companyName)}. ` : ""}${needed ? `Needed by ${esc(needed)}.` : ""}</p>
<table><thead><tr><th>Item code</th><th>Description</th><th class="num">Quantity</th></tr></thead><tbody>${rows}</tbody></table>
${closed
    ? `<div class="answer closed"><p><strong>This request is closed.</strong> ${esc(tenant.name)} no longer needs a quotation for it.</p></div>`
    : `<div class="answer"><p><strong>How to quote.</strong> Reply to the email this link came in with your price for the items above, excluding VAT, how long it is valid, and your reference.</p>${contact ? `<p class="muted" style="margin-top:6px">${contact}</p>` : ""}</div>`}
</div></main></body></html>`;
}
