import type { Metadata } from "next";
import { isCloud } from "@/lib/edition";
import { CloudLanding } from "@/components/public/CloudLanding";
import { InstalledWelcome } from "@/components/public/InstalledWelcome";

export function generateMetadata(): Metadata {
    return isCloud()
        ? {
            title: "MOTION Workshop Manager — run the whole job on one document",
            description:
                "Workshop management built for Namibia. Quotes, job cards, invoices and payments on a single document, entered once. From N$ 1,200.00 a month, excluding VAT.",
        }
        : {
            title: "MOTION Workshop Manager",
            description: "Sign in, the help library, and who to contact about this installation.",
        };
}

/**
 * The front door.
 *
 * Somebody already signed in has not come here to read about the product, so
 * they go straight to their workshop, exactly as before — decided before this
 * page renders, by `proxy.ts` and `app/start/route.ts`. Everybody else used to
 * be bounced to a login form with no explanation of what they were logging in
 * to, which is fine for staff and useless for anyone else.
 *
 * Rendered per request, so the edition and the support contacts come from the
 * running server rather than the build, without awaiting anything here. Any
 * await before the landing rendered — a session lookup, even `connection()` —
 * made it fail to hydrate in development about four loads in five; the route
 * segment option does the same job with none.
 */
export const dynamic = "force-dynamic";

export default function Home() {
    return isCloud() ? <CloudLanding /> : <InstalledWelcome />;
}
