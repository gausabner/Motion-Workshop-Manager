import type { Membership, UserGroup } from "@prisma/client";

/**
 * Permission matrix (PRD USR-02). The single place that knows what a group may do.
 *
 * Almost every permission here is about *changing* something. `reports:view`,
 * `documents:see_cost` and `customers:view_contact` are the exceptions, and
 * the last of those is the newest and the most important: without it a mechanic
 * with a phone could read every customer's address and telephone number, which
 * is fine among six people who know each other and is the first thing a
 * municipal security review objects to. The benchmark treats the same idea as a
 * per-user flag called "Limit Customer Information".
 */
export type Permission =
    | "customers:write"
    | "vehicles:write"
    | "products:write"
    | "documents:write"
    | "documents:process"
    | "documents:void"
    | "documents:see_cost"
    | "payments:take"
    | "messages:send"
    | "reports:view"
    | "customers:view_contact"
    | "settings:manage"
    | "users:manage"
    | "billing:manage";

const ALL: Permission[] = [
    "customers:write", "vehicles:write", "products:write", "documents:write", "documents:process",
    "documents:void", "documents:see_cost", "payments:take", "messages:send", "reports:view",
    "customers:view_contact", "settings:manage",
    "users:manage", "billing:manage",
];

const MATRIX: Record<UserGroup, ReadonlySet<Permission>> = {
    OWNER: new Set(ALL),
    ADMIN: new Set(ALL.filter((p) => p !== "billing:manage")),
    /**
     * Runs the workshop floor: assigns work to mechanics, moves jobs along,
     * orders and books in parts, and answers for how long everything took.
     *
     * Everything a service advisor has except taking money, plus the two
     * things a service advisor does not need: changing products and stock,
     * because the foreman is who notices a part is wrong; and cost visibility,
     * because judging whether a job was profitable is most of the role.
     *
     * Money is deliberately out. A foreman who books the labour and also takes
     * the cash is one person for the whole transaction, and separating those
     * two is the oldest control there is. It is a judgement, not a law — a
     * small workshop where the foreman covers the counter at lunchtime may
     * want it, and that is a conversation to have before granting it rather
     * than a default to inherit.
     */
    FOREMAN: new Set<Permission>([
        "customers:write", "vehicles:write", "products:write", "documents:write",
        "documents:process", "documents:see_cost", "messages:send", "reports:view",
        "customers:view_contact",
    ]),
    /**
     * Parts and stock: products, pricing, suppliers, purchase orders, stock
     * takes. Until now this work needed an Owner or an Admin, so the person on
     * the parts counter was given settings, the team and the ability to void
     * invoices in order to receive a delivery.
     *
     * Cost visibility is the point of the role rather than a convenience — a
     * parts manager who cannot see cost cannot price anything. They can put
     * parts on a job card; they cannot process it, take money, or touch
     * customers.
     */
    PARTS_MANAGER: new Set<Permission>([
        "products:write", "documents:write", "documents:see_cost", "reports:view",
    ]),
    SERVICE_ADVISOR: new Set([
        "customers:write", "vehicles:write", "documents:write", "documents:process",
        "documents:see_cost", "payments:take", "messages:send", "reports:view",
        "customers:view_contact",
    ]),
    MECHANIC: new Set(["vehicles:write", "documents:write"]),
    // Sends invoices and receipts to customers, so it needs to know where to
    // send them.
    INVOICE_PAY: new Set(["documents:write", "documents:process", "payments:take", "messages:send", "customers:view_contact"]),
    READ_ONLY: new Set(["reports:view"]),
};

/**
 * `extraPermissions` are grants an owner or admin has made to one person on top
 * of their role — the foreman who covers the counter at lunchtime gets
 * payments, without being promoted to Admin and handed settings, the team and
 * voiding as well.
 *
 * Grants only ever widen. There is no mechanism here to take a permission away
 * from a role, deliberately: a role that means something different for each
 * person is a role nobody can reason about, and "what can a Service Advisor
 * do?" stops having an answer.
 */
export function can(membership: Pick<Membership, "group"> & { extraPermissions?: string[] }, permission: Permission): boolean {
    if (MATRIX[membership.group].has(permission)) return true;
    return membership.extraPermissions?.includes(permission) ?? false;
}

export function assertCan(membership: Pick<Membership, "group">, permission: Permission): void {
    if (!can(membership, permission)) throw new Error(`Not allowed: ${permission}`);
}

/**
 * Every role, in order of reach.
 *
 * Adding Foreman meant touching three separate hardcoded lists — this file's
 * matrix, the invitable list in team/rules, and a `GROUPS` literal in
 * team/actions that fed a zod enum. Three places is how a role ends up
 * assignable but unvalidated, or validated but not offered. They all derive
 * from here now, so the next role is defined once.
 */
export const ALL_GROUPS = [
    "OWNER", "ADMIN", "FOREMAN", "PARTS_MANAGER", "SERVICE_ADVISOR", "MECHANIC", "INVOICE_PAY", "READ_ONLY",
] as const satisfies readonly UserGroup[];

/**
 * The permissions an owner or admin may grant to one person on top of their
 * role, and the words used to offer them.
 *
 * Kept short on purpose. Anything grantable is something a role deliberately
 * withholds, so every entry here is a decision somebody should have to make
 * out loud — a foreman taking cash, or voiding an invoice. Everything else
 * belongs in the matrix, where it means the same thing for everyone.
 */
export const GRANTABLE: { permission: Permission; label: string; caution: string }[] = [
    { permission: "payments:take", label: "Take payments", caution: "Books the labour and receives the cash" },
    { permission: "documents:void", label: "Void documents", caution: "Can cancel an invoice after it is processed" },
    { permission: "customers:view_contact", label: "See customer contact details", caution: "Addresses and phone numbers" },
];

export const GROUP_LABELS: Record<UserGroup, string> = {
    OWNER: "Owner",
    ADMIN: "Admin / Manager",
    FOREMAN: "Foreman",
    PARTS_MANAGER: "Parts & Stock",
    SERVICE_ADVISOR: "Service Advisor",
    MECHANIC: "Mechanic",
    INVOICE_PAY: "Invoice & Pay",
    READ_ONLY: "Read-only",
};
