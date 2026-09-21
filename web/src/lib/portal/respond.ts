import "server-only";
import { NextResponse } from "next/server";

/** Portal files: never cached by anything in between, never indexed, never leaking the link as a referrer. */
export const PORTAL_HEADERS = { "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "Cache-Control": "private, no-store" };

export function portalNotFound(): NextResponse {
    return new NextResponse("Not found", { status: 404, headers: PORTAL_HEADERS });
}
