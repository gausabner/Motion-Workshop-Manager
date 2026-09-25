import "server-only";
import { NextResponse } from "next/server";
import { safeFileName } from "@/lib/storage";

/**
 * How a CSV leaves the app.
 *
 * The byte-order mark is the point. Without it Excel on a Windows machine —
 * which is every machine in a council finance office — reads the file in the
 * system code page, and the first heading comes out with a `ï»¿` in front of
 * it or a currency symbol turns into mojibake. Declaring `charset=utf-8` in the
 * header does not help: Excel does not read it for a file opened from disk,
 * which is how these are always opened.
 *
 * Always an attachment. A CSV rendered in a browser tab is a wall of commas
 * that people then try to copy out by hand.
 */
export function csvResponse(csv: string, fileName: string): NextResponse {
    return new NextResponse(`﻿${csv}`, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${safeFileName(fileName, "export.csv")}"`,
            "Cache-Control": "private, no-store",
        },
    });
}
