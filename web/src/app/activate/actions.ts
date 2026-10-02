"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { choosePlan } from "@/lib/billing/registration";

export type ChoosePlanState = { ok: boolean; message?: string };

/**
 * Pick a tier and be given somewhere to pay.
 *
 * Signed-in only, and the tenant is never taken from the form — it is read from
 * the caller's own membership inside `choosePlan`. A tenant id in a form field
 * is a tenant id somebody can change, and the thing being written here decides
 * what a workshop is charged.
 */
export async function choosePlanAction(_prev: ChoosePlanState, formData: FormData): Promise<ChoosePlanState> {
    const user = await requireUser("/activate");
    const planId = String(formData.get("planId") ?? "").trim();

    const result = await choosePlan(user.id, planId);
    if (!result.ok) return { ok: false, message: result.message };

    // The page is a server component that decides what to show by reading the
    // registration, so it has to be told the registration changed. Without this
    // the subscription is created and the chooser stays on screen, which looks
    // exactly like a button that did nothing.
    revalidatePath("/activate");
    return { ok: true };
}
