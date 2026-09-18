import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { documentPdfInput } from "@/lib/pdf/data";
import { renderDocumentPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/respond";

export async function GET(request: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant } = await requireTenant(slug);

    const input = await documentPdfInput(db, tenant, id);
    if (!input) return new NextResponse("Not found", { status: 404 });

    const body = await renderDocumentPdf(input);
    const name = `${input.type.toLowerCase().replace("_", "-")}-${input.number ?? input.jobNumber ?? "draft"}.pdf`;
    return pdfResponse(body, name, new URL(request.url).searchParams.get("download") === "1");
}
