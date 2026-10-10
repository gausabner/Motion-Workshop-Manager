import "server-only";

import { connection } from "next/server";

/**
 * Waits for a request, so the settings below are read from the running server.
 *
 * They are environment variables of the deployment, not of the build. A page
 * that reads nothing else request-specific is prerendered when the image is
 * built — in CI, where none of them are set — and production then served a
 * support page saying no contact details were configured while the server had
 * all of them. Every otherwise-static page that reads these calls this first.
 */
export async function atRequestTime(): Promise<void> {
    await connection();
}

/**
 * Which front door this deployment shows.
 *
 * MOTION is sold two ways and they want opposite things from the page in
 * front of the sign-in form. A workshop arriving at the hosted service has to
 * be convinced; staff at a council whose procurement bought MOTION eighteen
 * months ago have already been sold to, and showing them a price is telling
 * them they have not bought it yet.
 *
 * One flag, set the same way `STORAGE_DRIVER` is, rather than two builds.
 * Everything that differs asks this, and everything that does not — the help
 * library, the support page, the shell — is written once.
 */

export type Edition = "cloud" | "onprem";

export function edition(): Edition {
    return process.env.MOTION_EDITION?.trim() === "onprem" ? "onprem" : "cloud";
}

export const isCloud = () => edition() === "cloud";
export const isOnPrem = () => edition() === "onprem";

/**
 * What an installed site says about itself.
 *
 * Read from the environment because it describes the installation, not the
 * workshop: the tenant's own name lives in the database and is a different
 * fact. Council IT asks who put this here and when, and "ask the person who
 * left in March" is the answer this exists to prevent.
 */
export type Installation = {
    /** Who installed it, e.g. "MOTION, 14 March 2026". */
    installedBy: string | null;
    /** A version or build somebody can quote down a phone. */
    version: string | null;
    /** Where the data physically is, in words: "this server", "the council's SQL host". */
    dataLocation: string | null;
    /** Who at the site fields the first call. */
    administrator: string | null;
};

export function installation(): Installation {
    const read = (name: string) => process.env[name]?.trim() || null;
    return {
        installedBy: read("MOTION_INSTALLED_BY"),
        version: read("MOTION_VERSION") ?? read("VERCEL_GIT_COMMIT_SHA")?.slice(0, 7) ?? null,
        dataLocation: read("MOTION_DATA_LOCATION"),
        administrator: read("MOTION_SITE_ADMIN"),
    };
}

/**
 * How to reach MOTION.
 *
 * Environment rather than hard-coded, because an installed site may be
 * supported by a reseller rather than by us, and because a number that is
 * wrong in the source is wrong on every page at once.
 *
 * A missing value is not rendered as an empty string — the page says the
 * channel is not set up, which is honest and obviously wrong to whoever
 * deployed it, rather than a blank space nobody notices.
 */
export type Support = { whatsapp: string | null; email: string | null; phone: string | null; hours: string | null };

export function support(): Support {
    const read = (name: string) => process.env[name]?.trim() || null;
    return {
        whatsapp: read("MOTION_SUPPORT_WHATSAPP"),
        email: read("MOTION_SUPPORT_EMAIL"),
        phone: read("MOTION_SUPPORT_PHONE"),
        hours: read("MOTION_SUPPORT_HOURS"),
    };
}
