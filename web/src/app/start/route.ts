import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser, signedInLanding } from "@/lib/auth/session";

/**
 * Where `/` sends somebody who carries a session cookie (see `proxy.ts`).
 *
 * The front page itself does no session lookup: waiting on the database
 * before it could render made it stream after the shell around it, and React
 * then failed to hydrate it in development about four loads in five. So the
 * signed-in case is decided here, before any page renders: a live session goes
 * to its workshop, and a cookie that no longer matches a session is cleared and
 * sent back to the front page — cleared, or the proxy would send it here again.
 *
 * `redirect` answers with a path, not a full address, so the browser stays on
 * the host it asked for whatever host the server thinks it is.
 */
export async function GET() {
    const user = await getSessionUser();
    if (user) redirect(await signedInLanding(user.id));
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/");
}
