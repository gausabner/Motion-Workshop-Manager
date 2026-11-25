"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorityKind, WorkshopKind } from "@prisma/client";
import { requireFeature } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { str, type ActionState } from "@/lib/forms";
import { organisationSettingsSchema, parseSettings, requisitionSettingsSchema } from "@/lib/settings/schema";
import { parseVoteCsv } from "@/lib/requisitions/csv";
import {
    addStaff,
    appoint,
    archiveOrgUnit,
    archiveVote,
    archiveWorkshop,
    importVotes,
    removeStaff,
    replaceAuthority,
    replaceStaff,
    revoke,
    saveDesignations,
    saveOrgUnit,
    saveVote,
    saveWorkshop,
} from "@/lib/requisitions/organisation";

/**
 * The council's organisation, workshops, appointments and requisition rules,
 * as the settings screens change them. Council plan only, and settings work:
 * the same people who may change the workshop's settings may change these.
 */

async function council(slug: string) {
    const ctx = await requireFeature(slug, "requisitions");
    assertCan(ctx.membership, "settings:manage");
    return ctx;
}

const SETTINGS = (slug: string, page: string) => `/${slug}/dashboard/settings/${page}`;

function refresh(slug: string, ...pages: string[]) {
    for (const page of pages) revalidatePath(SETTINGS(slug, page));
}

async function attempt(fn: () => Promise<unknown>, done: string): Promise<ActionState> {
    try {
        await fn();
        return { ok: true, message: done };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not saved. Try again." };
    }
}

// ───────────────────────── organisation ─────────────────────────

export async function saveOrganisationLevels(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const twoLevels = formData.get("levels") === "two";
    const parsed = organisationSettingsSchema.safeParse({ topLevel: str(formData, "topLevel") ?? "", secondLevel: twoLevels ? (str(formData, "secondLevel") ?? "") : null });
    if (!parsed.success) return { ok: false, message: "Name each level of the organisation." };
    if (!twoLevels && (await db.orgUnit.count({ where: { parentId: { not: null } } })) > 0) {
        return { ok: false, message: "Some units sit under others. Move them to the top level before using one level." };
    }
    const settings = parseSettings(tenant.settings);
    await db.tenant.update({ where: { id: tenant.id }, data: { settings: { ...settings, organisation: parsed.data } } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { section: "organisation", ...parsed.data } } });
    refresh(slug, "organisation", "workshops");
    return { ok: true, message: "Saved" };
}

export async function saveOrgUnitAction(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(
        () => db.$transaction((tx) => saveOrgUnit(tx, tenant, user.id, id, { name: str(formData, "name") ?? "", parentId: str(formData, "parentId") ?? null })),
        id ? "Saved" : "Added",
    );
    refresh(slug, "organisation", "workshops");
    return result;
}

export async function archiveOrgUnitAction(slug: string, id: string, archived: boolean): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(() => db.$transaction((tx) => archiveOrgUnit(tx, tenant, user.id, id, archived)), archived ? "Archived" : "Restored");
    refresh(slug, "organisation");
    return result;
}

export async function saveVoteAction(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(
        () => db.$transaction((tx) => saveVote(tx, tenant, user.id, id, { code: str(formData, "code") ?? "", name: str(formData, "name") ?? "", orgUnitId: str(formData, "orgUnitId") ?? "" })),
        id ? "Saved" : "Added",
    );
    refresh(slug, "organisation");
    return result;
}

export async function archiveVoteAction(slug: string, id: string, archived: boolean): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(() => db.$transaction((tx) => archiveVote(tx, tenant, user.id, id, archived)), archived ? "Archived" : "Restored");
    refresh(slug, "organisation");
    return result;
}

/** Paste the finance system's export. All lines or none: a half-imported vote list is worse than none. */
export async function importVotesAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const { rows, errors } = parseVoteCsv(str(formData, "csv") ?? "");
    if (errors.length) return { ok: false, message: errors.slice(0, 5).map((e) => `Line ${e.line}: ${e.message}`).join(" ") };
    if (rows.length === 0) return { ok: false, message: "Paste the votes: one per line, the vote number, its name and its unit." };
    try {
        const result = await db.$transaction((tx) => importVotes(tx, tenant, user.id, rows));
        if (result.errors.length) return { ok: false, message: result.errors.slice(0, 5).map((e) => `Line ${e.line}: ${e.message}`).join(" ") };
        refresh(slug, "organisation");
        return { ok: true, message: `${result.created} added, ${result.updated} updated.` };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not imported. Try again." };
    }
}

// ───────────────────────── workshops ─────────────────────────

export async function saveWorkshopAction(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const kind = z.enum(WorkshopKind).safeParse(str(formData, "kind"));
    if (!kind.success) return { ok: false, message: "Choose what kind of place it is." };
    const result = await attempt(
        () => db.$transaction((tx) => saveWorkshop(tx, tenant, user.id, id, { name: str(formData, "name") ?? "", kind: kind.data, orgUnitId: str(formData, "orgUnitId") ?? "" })),
        id ? "Saved" : "Added",
    );
    refresh(slug, "workshops");
    return result;
}

export async function archiveWorkshopAction(slug: string, id: string, archived: boolean): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(() => db.$transaction((tx) => archiveWorkshop(tx, tenant, user.id, id, archived)), archived ? "Archived" : "Restored");
    refresh(slug, "workshops");
    return result;
}

// ───────────────────────── appointments ─────────────────────────

export async function appointAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const kind = z.enum(AuthorityKind).safeParse(str(formData, "kind"));
    if (!kind.success) return { ok: false, message: "Choose what they sign for." };
    const membershipId = str(formData, "membershipId");
    if (!membershipId) return { ok: false, message: "Choose somebody on the team." };
    const result = await attempt(
        () => db.$transaction((tx) => appoint(tx, tenant, user.id, {
            kind: kind.data,
            workshopId: str(formData, "workshopId") ?? null,
            orgUnitId: str(formData, "orgUnitId") ?? null,
            membershipId,
            deputy: formData.get("deputy") === "on",
        })),
        "Appointed",
    );
    refresh(slug, "organisation", "workshops", "requisitions");
    return result;
}

export async function revokeAction(slug: string, id: string): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(() => db.$transaction((tx) => revoke(tx, tenant, user.id, id)), "Removed");
    refresh(slug, "organisation", "workshops", "requisitions");
    return result;
}

export async function replaceAuthorityAction(slug: string, id: string, membershipId: string): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    if (!membershipId) return { ok: false, message: "Choose who takes their place." };
    const result = await attempt(() => db.$transaction((tx) => replaceAuthority(tx, tenant, user.id, id, membershipId)), "Replaced");
    refresh(slug, "organisation", "workshops", "requisitions");
    return result;
}

// ───────────────────────── workshop staff ─────────────────────────

export async function addStaffAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const workshopId = str(formData, "workshopId");
    const membershipId = str(formData, "membershipId");
    if (!workshopId) return { ok: false, message: "Choose the workshop or bay." };
    if (!membershipId) return { ok: false, message: "Choose somebody on the team." };
    const result = await attempt(() => db.$transaction((tx) => addStaff(tx, tenant, user.id, { workshopId, membershipId, role: str(formData, "role") ?? "" })), "Added to the staff");
    refresh(slug, "workshops", "users");
    return result;
}

export async function removeStaffAction(slug: string, id: string): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const result = await attempt(() => db.$transaction((tx) => removeStaff(tx, tenant, user.id, id)), "Removed");
    refresh(slug, "workshops");
    return result;
}

export async function replaceStaffAction(slug: string, id: string, membershipId: string): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    if (!membershipId) return { ok: false, message: "Choose who takes their place." };
    const result = await attempt(() => db.$transaction((tx) => replaceStaff(tx, tenant, user.id, id, membershipId)), "Replaced");
    refresh(slug, "workshops", "users");
    return result;
}

// ───────────────────────── people ─────────────────────────

/** Designations and pay numbers are about people, so they are the team manager's to set. */
export async function saveDesignationsAction(slug: string, membershipId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireFeature(slug, "requisitions");
    assertCan(membership, "users:manage");
    const result = await attempt(
        () => db.$transaction((tx) => saveDesignations(tx, tenant, user.id, membershipId, {
            designations: formData.getAll("designations").map(String),
            payNumber: str(formData, "payNumber") ?? null,
        })),
        "Saved",
    );
    refresh(slug, "users");
    return result;
}

// ───────────────────────── requisition rules ─────────────────────────

/**
 * The council's own figures: the value at which the over-limit approver signs
 * too, how far an order may run over the approved value, and how many
 * quotations each value of purchase needs.
 */
export async function saveRequisitionRules(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user } = await council(slug);
    const number = (name: string) => {
        const v = str(formData, name);
        return v === undefined ? undefined : Number(v.replace(/[\s,]/g, ""));
    };
    const bands: { from: number; quotes: number }[] = [];
    for (let i = 0; i < 6; i++) {
        const from = number(`band_from_${i}`);
        const quotes = number(`band_quotes_${i}`);
        if (from === undefined && quotes === undefined) continue;
        bands.push({ from: from ?? 0, quotes: quotes ?? 1 });
    }
    if (!bands.some((b) => b.from === 0)) bands.unshift({ from: 0, quotes: 1 });
    const parsed = requisitionSettingsSchema.safeParse({
        overLimitAt: number("overLimitAt") ?? null,
        reapprovalTolerancePercent: number("reapprovalTolerancePercent") ?? 10,
        quoteBands: bands.sort((a, b) => a.from - b.from),
    });
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue?.path[0] ?? "");
        const message =
            field === "overLimitAt" ? "Enter the value limit as an amount, or leave it blank for no limit."
            : field === "reapprovalTolerancePercent" ? "Enter the tolerance as a percentage from 0 to 100."
            : "Each band needs an amount from which it applies, and between 1 and 10 quotations.";
        return { ok: false, message };
    }
    const froms = parsed.data.quoteBands.map((b) => b.from);
    if (new Set(froms).size !== froms.length) return { ok: false, message: "Two bands start at the same amount. Give each its own." };

    const settings = parseSettings(tenant.settings);
    await db.tenant.update({ where: { id: tenant.id }, data: { settings: { ...settings, requisitions: parsed.data } } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { section: "requisitions", ...parsed.data } } });
    refresh(slug, "requisitions");
    return { ok: true, message: "Saved" };
}
