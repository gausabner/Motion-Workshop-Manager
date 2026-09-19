"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { templateDraftSchema } from "@/lib/inspections/template-rules";
import { deleteTemplate, duplicateTemplate, saveTemplate, setTemplateActive } from "@/lib/inspections/templates";

type Result = { ok: true; id: string } | { ok: false; message: string; path?: (string | number)[] };

const listPath = (slug: string) => `/${slug}/dashboard/settings/inspections`;

async function manage(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    return ctx;
}

export async function saveTemplateAction(slug: string, id: string | null, input: unknown): Promise<Result> {
    const { db, tenant } = await manage(slug);
    const parsed = templateDraftSchema.safeParse(input);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { ok: false, message: issue?.message ?? "Check the template", path: issue?.path as (string | number)[] };
    }
    try {
        const saved = await db.$transaction((tx) => saveTemplate(tx, tenant.id, id, parsed.data));
        revalidatePath(listPath(slug));
        revalidatePath(`${listPath(slug)}/${saved}`);
        return { ok: true, id: saved };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The template was not saved" };
    }
}

export async function newTemplateAction(slug: string): Promise<void> {
    const { db, tenant } = await manage(slug);
    const names = (await db.inspectionTemplate.findMany({ select: { name: true } })).map((t) => t.name.toLowerCase());
    let name = "New inspection";
    for (let n = 2; names.includes(name.toLowerCase()); n++) name = `New inspection (${n})`;
    const id = await db.$transaction((tx) => saveTemplate(tx, tenant.id, null, { name, groups: [{ name: "General", items: [{ description: "First check", inputs: [], productId: null, defaultEstimate: null }] }] }));
    redirect(`${listPath(slug)}/${id}`);
}

export async function duplicateTemplateAction(slug: string, id: string): Promise<void> {
    const { db, tenant } = await manage(slug);
    const copy = await db.$transaction((tx) => duplicateTemplate(tx, tenant.id, id));
    redirect(`${listPath(slug)}/${copy}`);
}

export async function setTemplateActiveAction(slug: string, id: string, active: boolean): Promise<{ ok: boolean; message?: string }> {
    const { db } = await manage(slug);
    try {
        await db.$transaction((tx) => setTemplateActive(tx, id, active));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not changed" };
    }
    revalidatePath(listPath(slug));
    return { ok: true };
}

export async function deleteTemplateAction(slug: string, id: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await manage(slug);
    try {
        await db.$transaction((tx) => deleteTemplate(tx, id));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not deleted" };
    }
    revalidatePath(listPath(slug));
    return { ok: true };
}
