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
    | "reports:view"
    | "settings:manage"
    | "users:manage"
    | "billing:manage";

const ALL: Permission[] = [
    "customers:write", "vehicles:write", "products:write", "documents:write", "documents:process",
    "documents:void", "documents:see_cost", "payments:take", "reports:view", "settings:manage",
    "users:manage", "billing:manage",
];

const MATRIX: Record<UserGroup, ReadonlySet<Permission>> = {
    OWNER: new Set(ALL),
    ADMIN: new Set(ALL.filter((p) => p !== "billing:manage")),
    SERVICE_ADVISOR: new Set([
        "customers:write", "vehicles:write", "documents:write", "documents:process",
        "documents:see_cost", "payments:take", "reports:view",
    ]),
    MECHANIC: new Set(["vehicles:write", "documents:write"]),
    INVOICE_PAY: new Set(["documents:write", "documents:process", "payments:take"]),
    READ_ONLY: new Set(["reports:view"]),
};

export function can(membership: Pick<Membership, "group">, permission: Permission): boolean {
    return MATRIX[membership.group].has(permission);
}

export function assertCan(membership: Pick<Membership, "group">, permission: Permission): void {
    if (!can(membership, permission)) throw new Error(`Not allowed: ${permission}`);
}

export const GROUP_LABELS: Record<UserGroup, string> = {
    OWNER: "Owner",
    ADMIN: "Admin / Manager",
    SERVICE_ADVISOR: "Service Advisor",
    MECHANIC: "Mechanic",
    INVOICE_PAY: "Invoice & Pay",
    READ_ONLY: "Read-only",
};
