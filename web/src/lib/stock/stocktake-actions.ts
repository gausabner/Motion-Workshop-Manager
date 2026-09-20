"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { applyStockTake, cancelStockTake, saveCounts, startStockTake, type Scope } from "@/lib/stock/stocktake-service";

const base = (slug: string) => `/${slug}/dashboard/products/stock-take`;

const scopeSchema = z.object({
    location: z.string().trim().max(40).optional(),
    codeFrom: z.string().trim().max(40).optional(),
    codeTo: z.string().trim().max(40).optional(),
    groupId: z.union([z.literal(""), z.string().max(40)]).optional().transform((v) => (v ? v : undefined)),
    includeZero: z.boolean().default(false),
});

const countsSchema = z.array(z.object({
    lineId: z.string().min(1).max(40),
    counted: z.union([z.null(), z.coerce.number().min(-999_999).max(999_999)]),
    note: z.string().trim().max(200).nullish(),
})).max(2000);

async function counter(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "products:write");
    return ctx;
}

export async function startStockTakeAction(slug: string, input: unknown, blind: boolean, note?: string): Promise<{ ok: false; message: string }> {
    const { db, tenant, membership } = await counter(slug);
    const parsed = scopeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the range" };
    let id: string;
    try {
        const started = await db.$transaction((tx) => startStockTake(tx, tenant, membership.id, parsed.data as Scope, blind, note), { timeout: 30_000 });
        id = started.id;
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The count was not started" };
    }
    revalidatePath(base(slug));
    redirect(`${base(slug)}/${id}`);
}

export async function saveCountsAction(slug: string, takeId: string, counts: unknown): Promise<{ ok: boolean; message?: string }> {
    const { db } = await counter(slug);
    const parsed = countsSchema.safeParse(counts);
    if (!parsed.success) return { ok: false, message: "Those counts were not understood" };
    try {
        await db.$transaction((tx) => saveCounts(tx, takeId, parsed.data), { timeout: 30_000 });
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not saved" };
    }
    revalidatePath(`${base(slug)}/${takeId}`);
    return { ok: true };
}

export async function applyStockTakeAction(slug: string, takeId: string, counts: unknown): Promise<{ ok: boolean; message: string }> {
    const { db, tenant, membership } = await counter(slug);
    const parsed = countsSchema.safeParse(counts);
    if (!parsed.success) return { ok: false, message: "Those counts were not understood" };
    try {
        const result = await db.$transaction(async (tx) => {
            await saveCounts(tx, takeId, parsed.data);
            return applyStockTake(tx, tenant, membership.id, takeId);
        }, { timeout: 30_000 });
        revalidatePath(`${base(slug)}/${takeId}`);
        revalidatePath(`/${slug}/dashboard/products`);
        const moved = result.movedDuringCount > 0 ? ` ${result.movedDuringCount} had moved while you were counting, and were adjusted against the ledger as it stands now.` : "";
        return { ok: true, message: `Applied. ${result.posted} product${result.posted === 1 ? "" : "s"} corrected.${moved}` };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not applied" };
    }
}

export async function cancelStockTakeAction(slug: string, takeId: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await counter(slug);
    try {
        await db.$transaction((tx) => cancelStockTake(tx, takeId));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not cancelled" };
    }
    revalidatePath(base(slug));
    return { ok: true };
}
