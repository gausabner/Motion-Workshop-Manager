"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { createKey, revokeKey } from "./key-service";

const path = (slug: string) => `/${slug}/dashboard/settings/api`;

const createSchema = z.object({
    name: z.string().trim().min(1, "Give the key a name, so you know what to revoke later").max(60),
    write: z.boolean().default(false),
});

/**
 * Keys are owner work. A key can read every customer and invoice in the
 * workshop, so making one is not something a counter hand does in passing.
 */
async function owner(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    return ctx;
}

export type NewKeyState = { ok: boolean; message?: string; token?: string; name?: string };

export async function createApiKey(slug: string, _prev: NewKeyState, formData: FormData): Promise<NewKeyState> {
    const ctx = await owner(slug);
    const parsed = createSchema.safeParse({
        name: formData.get("name"),
        write: formData.get("write") === "on",
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "That key could not be made." };

    const { token } = await createKey(ctx.db, ctx.tenant.id, {
        name: parsed.data.name,
        scopes: parsed.data.write ? ["READ", "WRITE"] : ["READ"],
        membershipId: ctx.membership.id,
    });
    revalidatePath(path(slug));
    // The only time this value exists outside the integrator's hands.
    return { ok: true, token, name: parsed.data.name };
}

export async function revokeApiKey(slug: string, id: string): Promise<void> {
    const ctx = await owner(slug);
    await revokeKey(ctx.db, id);
    revalidatePath(path(slug));
}
