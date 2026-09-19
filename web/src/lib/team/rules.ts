import type { MembershipStatus, UserGroup } from "@prisma/client";

/**
 * Who may change whom on the team. Pure, so the lock-out cases are tested
 * without a database.
 *
 * The rules exist to stop the two ways a workshop locks itself out: the last
 * owner demoting or deactivating themselves, and an admin quietly promoting
 * themselves to owner.
 */

export type MemberSnapshot = { id: string; group: UserGroup; status: MembershipStatus };
export type MemberChange = { group: UserGroup; status: MembershipStatus };

export function memberChangeError(
    actor: MemberSnapshot,
    target: MemberSnapshot,
    change: MemberChange,
    activeOwnerCount: number,
): string | null {
    const touchesOwner = target.group === "OWNER" || change.group === "OWNER";
    if (touchesOwner && actor.group !== "OWNER") return "Only an owner can make someone an owner, or change an owner.";
    if (actor.id === target.id && (change.group !== target.group || change.status !== target.status)) {
        return "You cannot change your own role or switch yourself off. Ask another owner or admin.";
    }
    const losesOwner = target.group === "OWNER" && target.status === "ACTIVE" && (change.group !== "OWNER" || change.status !== "ACTIVE");
    if (losesOwner && activeOwnerCount <= 1) return "The workshop needs at least one active owner.";
    return null;
}

/** Sensible flags for a role, so inviting a mechanic puts them on the diary without a second step. */
export function flagsForGroup(group: UserGroup): { isMechanic: boolean; showOnDiary: boolean; isServiceAdvisor: boolean } {
    return {
        isMechanic: group === "MECHANIC",
        showOnDiary: group === "MECHANIC",
        isServiceAdvisor: group === "SERVICE_ADVISOR" || group === "OWNER" || group === "ADMIN",
    };
}

/** Groups an inviter may hand out. Only an owner creates another owner. */
export function invitableGroups(actorGroup: UserGroup): UserGroup[] {
    const all: UserGroup[] = ["OWNER", "ADMIN", "SERVICE_ADVISOR", "MECHANIC", "INVOICE_PAY", "READ_ONLY"];
    return actorGroup === "OWNER" ? all : all.filter((g) => g !== "OWNER");
}

export const INVITE_DAYS = 7;
