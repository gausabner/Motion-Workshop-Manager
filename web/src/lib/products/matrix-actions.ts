"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { STARTER_BANDS } from "@/lib/products/matrix";
import { deleteMatrix, previewReprice, repriceMatrix, saveMatrix, type MatrixInput } from "@/lib/products/matrix-service";

const base = (slug: string) => `/${slug}/dashboard/settings/pricing`;

const matrixSchema = z.object({
    name: z.string().trim().min(2, "Give the matrix a name").max(60),
    basis: z.enum(["MARKUP", "MARGIN"]),
    rounding: z.enum(["NONE", "WHOLE", "NEAREST_5", "NEAREST_10", "ENDS_99"]),
    active: z.boolean(),
    note: z.string().trim().max(300).nullish(),
    bands: z.array(z.object({
        costFrom: z.coerce.number().min(0).max(9_999_999),
        costTo: z.union([z.null(), z.coerce.number().min(0).max(9_999_999)]),
        percent: z.coerce.number().min(-100).max(1000),
    })).min(1, "A matrix needs at least one band").max(20, "Keep a matrix under 20 bands"),
});

async function pricer(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "products:write");
    return ctx;
}

export async function newMatrixAction(slug: string): Promise<void> {
    const { db, tenant } = await pricer(slug);
    const names = (await db.priceMatrix.findMany({ select: { name: true } })).map((m) => m.name.toLowerCase());
    let name = "Parts pricing";
    for (let n = 2; names.includes(name.toLowerCase()); n++) name = `Parts pricing (${n})`;
    const id = await db.$transaction((tx) => saveMatrix(tx, tenant.id, null, { name, basis: "MARKUP", rounding: "NONE", active: true, bands: STARTER_BANDS }));
    redirect(`${base(slug)}/${id}`);
}

export async function saveMatrixAction(slug: string, id: string | null, input: unknown): Promise<{ ok: boolean; message: string; id?: string }> {
    const { db, tenant } = await pricer(slug);
    const parsed = matrixSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the bands" };
    try {
        const matrixId = await db.$transaction((tx) => saveMatrix(tx, tenant.id, id, parsed.data as MatrixInput));
        revalidatePath(base(slug));
        revalidatePath(`${base(slug)}/${matrixId}`);
        return { ok: true, message: "Saved. Prices follow it from the next cost change, or reprice now.", id: matrixId };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not saved" };
    }
}

export async function deleteMatrixAction(slug: string, id: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await pricer(slug);
    try {
        await db.$transaction((tx) => deleteMatrix(tx, id));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not deleted" };
    }
    revalidatePath(base(slug));
    redirect(base(slug));
}

export async function previewRepriceAction(slug: string, id: string) {
    const { db } = await pricer(slug);
    return previewReprice(db, id);
}

export async function repriceMatrixAction(slug: string, id: string): Promise<{ ok: boolean; message: string }> {
    const { db } = await pricer(slug);
    try {
        const changed = await db.$transaction((tx) => repriceMatrix(tx, id), { timeout: 30_000 });
        revalidatePath(`${base(slug)}/${id}`);
        revalidatePath(`/${slug}/dashboard/products`);
        return { ok: true, message: changed === 0 ? "Every price already matches the matrix." : `${changed} price${changed === 1 ? "" : "s"} brought into line.` };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not repriced" };
    }
}
