import "server-only";
import { headers } from "next/headers";

/** Where links we hand out point. `APP_URL` wins, so a link made on localhost in testing is not what a customer or new mechanic receives in production. */
export async function requestOrigin(): Promise<string> {
    const configured = process.env.APP_URL?.trim();
    if (configured) return configured;
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
}
