import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, signedInLanding } from "@/lib/auth/session";
import { isCloud } from "@/lib/edition";
import { CloudLanding } from "@/components/public/CloudLanding";
import { InstalledWelcome } from "@/components/public/InstalledWelcome";

export function generateMetadata(): Metadata {
    return isCloud()
        ? {
            title: "MOTION Workshop Manager — run the whole job on one document",
            description:
                "Workshop management built for Namibia. The quote becomes the job card becomes the invoice, without retyping. Licence discs, roadworthies, VAT at 15 %, WhatsApp. From N$1,200 a month.",
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
 * they go straight to their workshop, exactly as before. Everybody else used
 * to be bounced to a login form with no explanation of what they were logging
 * in to — which is fine for staff and useless for anyone else.
 */
export default async function Home() {
    const user = await getSessionUser();
    if (user) {
        redirect(await signedInLanding(user.id));
    }
    return isCloud() ? <CloudLanding /> : <InstalledWelcome />;
}
