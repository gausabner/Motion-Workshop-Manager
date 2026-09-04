import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "motion_session";

/** Public routes that never need a session. Everything under /{slug}/dashboard, /admin and /pwa does. */
const PUBLIC = [/^\/$/, /^\/login$/, /^\/register$/, /^\/api\/health$/, /^\/[^/]+\/book(\/|$)/, /^\/[^/]+\/portal(\/|$)/];
const PROTECTED = /^\/[^/]+\/(dashboard|admin|pwa)(\/|$)/;

export function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
    if (PROTECTED.test(pathname) && !req.cookies.get(SESSION_COOKIE)?.value) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.search = `?next=${encodeURIComponent(pathname + search)}`;
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
