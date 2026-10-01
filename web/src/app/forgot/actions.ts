"use server";

import { requestPasswordReset } from "@/lib/auth/forgot";

export type ForgotState = { sent: boolean; email: string };

/**
 * The reply is the same whether or not the address is on an account, so this
 * returns `sent: true` unconditionally. The branch that would make it useful
 * to somebody probing for addresses does not exist to be forgotten later.
 */
export async function requestResetAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
    const email = String(formData.get("email") ?? "").trim();
    await requestPasswordReset(email);
    return { sent: true, email };
}
