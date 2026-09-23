import type { Membership, UserGroup } from "@prisma/client";

/** Permission matrix (PRD USR-02). Keep this the single place that knows what a group may do. */
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
    | "settings:manage"
    | "users:manage"
    | "billing:manage";

const ALL: Permission[] = [
    "customers:write", "vehicles:write", "products:write", "documents:write", "documents:process",
    "documents:void", "documents:see_cost", "payments:take", "messages:send", "reports:view", "settings:manage",
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
    ]),
    SERVICE_ADVISOR: new Set([
        "customers:write", "vehicles:write", "documents:write", "documents:process",
        "documents:see_cost", "payments:take", "messages:send", "reports:view",
    ]),
    MECHANIC: new Set(["vehicles:write", "documents:write"]),
    INVOICE_PAY: new Set(["documents:write", "documents:process", "payments:take", "messages:send"]),
    READ_ONLY: new Set(["reports:view"]),
};

export function can(membership: Pick<Membership, "group">, permission: Permission): boolean {
    return MATRIX[membership.group].has(permission);
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
    "OWNER", "ADMIN", "FOREMAN", "SERVICE_ADVISOR", "MECHANIC", "INVOICE_PAY", "READ_ONLY",
] as const satisfies readonly UserGroup[];

export const GROUP_LABELS: Record<UserGroup, string> = {
    OWNER: "Owner",
    ADMIN: "Admin / Manager",
    FOREMAN: "Foreman",
    SERVICE_ADVISOR: "Service Advisor",
    MECHANIC: "Mechanic",
    INVOICE_PAY: "Invoice & Pay",
    READ_ONLY: "Read-only",
};
