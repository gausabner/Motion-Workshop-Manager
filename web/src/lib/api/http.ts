import { Prisma } from "@prisma/client";

/**
 * The shape every endpoint answers in.
 *
 * Workshop Software streams its lists as Server-Sent Events and hides paging,
 * sorting and filtering inside the URL path (`/filters/*​/vehicles/0/10/plate_number/asc/false`).
 * It works, but every integrator has to learn it. We answer ordinary JSON,
 * page with `?limit=&cursor=`, and put the next cursor in the body — so
 * `curl` and a browser's address bar are enough to explore the whole API.
 */

export type ApiErrorCode =
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "invalid_request"
    | "rate_limited"
    | "conflict"
    | "server_error";

const STATUS: Record<ApiErrorCode, number> = {
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    invalid_request: 422,
    rate_limited: 429,
    conflict: 409,
    server_error: 500,
};

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): Response {
    return new Response(JSON.stringify(body, null, 2), {
        status: init?.status ?? 200,
        headers: { ...HEADERS, ...init?.headers },
    });
}

/**
 * One error shape, always: a code a program can branch on and a message a
 * person can act on. `field` is set when the request was understood but one
 * value in it was wrong.
 */
export function fail(code: ApiErrorCode, message: string, extra?: { field?: string; headers?: Record<string, string> }): Response {
    return json({ error: { code, message, ...(extra?.field ? { field: extra.field } : {}) } }, { status: STATUS[code], headers: extra?.headers });
}

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export type Paging = { limit: number; cursor: string | null };

/** `limit` is clamped rather than refused: a caller asking for 5000 wants everything, and will page for it. */
export function paging(url: URL): Paging {
    const raw = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_LIMIT) : DEFAULT_LIMIT;
    const cursor = url.searchParams.get("cursor");
    return { limit, cursor: cursor && cursor.length > 0 ? cursor : null };
}

/**
 * Cursor paging over a stable id order. We fetch one row past the limit: if it
 * comes back there is another page, and its id is the cursor. No offsets, so a
 * record created mid-sync cannot make a later page repeat or skip a row.
 */
export function page<T extends { id: string }>(rows: T[], limit: number): { data: T[]; nextCursor: string | null } {
    const data = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? (data[data.length - 1]?.id ?? null) : null;
    return { data, nextCursor };
}

/** What Prisma needs to resume from a cursor: skip the cursor row itself. */
export function cursorArgs(cursor: string | null, limit: number) {
    return { take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
}

/**
 * Money leaves as a string. JSON numbers are doubles, and a workshop's ledger
 * read into a double and written back is how cents go missing — the same
 * reason Decimal never reaches a client component.
 */
export function amount(value: Prisma.Decimal | number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return new Prisma.Decimal(value).toFixed(2);
}

/** Quantities and hours keep their own precision; they are not money. */
export function quantity(value: Prisma.Decimal | number | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    return new Prisma.Decimal(value).toString();
}

/** Moments go out as UTC ISO; a `@db.Date` column goes out as the plain day it is. */
export const moment = (d: Date | null | undefined): string | null => d?.toISOString() ?? null;
export const day = (d: Date | null | undefined): string | null => (d ? d.toISOString().slice(0, 10) : null);
