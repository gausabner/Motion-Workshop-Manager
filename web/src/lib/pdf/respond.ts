import "server-only";
import { NextResponse } from "next/server";
import { safeFileName } from "@/lib/storage";

/**
 * How a PDF leaves the app. `inline` so it opens in the tab and the browser's
 * own print button is one click away — which is what a counter actually wants
 * — while `?download=1` forces a save for attaching to something else.
 */
export function pdfResponse(body: Buffer, fileName: string, download: boolean): NextResponse {
    return new NextResponse(new Uint8Array(body), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(body.byteLength),
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safeFileName(fileName, "document.pdf")}"`,
            "Cache-Control": "private, no-store",
        },
    });
}
