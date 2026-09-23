import type { Membership } from "@prisma/client";
import { can } from "@/lib/auth/permissions";

/** Every field that identifies how to reach a customer, rather than which car is theirs. */
const CONTACT_FIELDS = [
    "mobile", "phone", "fax", "email", "web",
    "streetAddress1", "streetAddress2", "streetSuburb", "streetCity", "streetRegion", "streetPostcode",
    "postalAddress1", "postalAddress2", "postalSuburb", "postalCity", "postalRegion", "postalPostcode",
] as const;

/**
 * Remove a customer's contact details for people whose role does not include
 * seeing them.
 *
 * Done on the server, before the data is handed to a component, so it is never
 * serialised into the page at all. Hiding these with CSS or a conditional in
 * the markup would leave them sitting in the HTML for anyone who opens the
 * developer tools — which is not a defence, it is a curtain.
 *
 * Names are deliberately left alone. A mechanic needs to know whose car is on
 * the lift, and a job card with no customer on it is unusable. What they do not
 * need is the address and telephone number of every customer the workshop has
 * ever had, which is what they could read until now.
 */
export function redactContact<T extends Record<string, unknown>>(
    row: T,
    membership: Pick<Membership, "group"> & { extraPermissions?: string[] },
): T {
    if (can(membership, "customers:view_contact")) return row;
    const out = { ...row };
    for (const field of CONTACT_FIELDS) {
        if (field in out) (out as Record<string, unknown>)[field] = null;
    }
    return out;
}

export function redactContactAll<T extends Record<string, unknown>>(
    rows: T[],
    membership: Pick<Membership, "group"> & { extraPermissions?: string[] },
): T[] {
    if (can(membership, "customers:view_contact")) return rows;
    return rows.map((r) => redactContact(r, membership));
}
