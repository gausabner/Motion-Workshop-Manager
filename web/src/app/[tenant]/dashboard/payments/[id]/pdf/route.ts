import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { receiptPdfInput } from "@/lib/pdf/data";
import { renderReceiptPdf } from "@/lib/pdf/receipt";
import { pdfResponse } from "@/lib/pdf/respond";

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "payments:take")) return new NextResponse("Not found", { status: 404 });

    const input = await receiptPdfInput(db, tenant, id);
    if (!input) return new NextResponse("Not found", { status: 404 });

    const body = await renderReceiptPdf(input);
    const name = `${input.direction.toLowerCase()}-${input.number ?? "draft"}.pdf`;
    return pdfResponse(body, name, new URL(request.url).searchParams.get("download") === "1");
}
