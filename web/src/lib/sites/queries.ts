import "server-only";
import { prisma } from "@/lib/db";

/**
 * The sites a person may open.
 *
 * A site is a tenant. Our clients are separate legal entities — their own tax
 * number, their own bank account, their own books — so nothing is shared
 * between them: not stock, not customers, not document numbers, not reports. A
 * customer who visits two of them is two customer records, because to the two
 * businesses that is what they are.
 *
 * This is therefore the only query in the application that deliberately looks
 * across tenants, and it is not a hole in the boundary: it reads the
 * *memberships of one user*, which is the record of which doors that person
 * has been given a key to. It returns a name and a slug, never a workshop's
 * contents, and every page behind those slugs still checks membership for
 * itself through `requireTenant`.
 */
export async function sitesForUser(userId: string): Promise<{ slug: string; name: string }[]> {
    const memberships = await prisma.membership.findMany({
        where: { userId, status: "ACTIVE", tenant: { isActive: true } },
        select: { tenant: { select: { slug: true, name: true } } },
        orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => m.tenant);
}
