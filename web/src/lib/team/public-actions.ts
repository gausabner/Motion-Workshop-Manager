"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession } from "@/lib/auth/session";
import { type ActionState, fromZod, str } from "@/lib/forms";
import { acceptInvitation } from "@/lib/team/service";

const joinSchema = z.object({
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    mobile: z.string().trim().max(40).optional(),
    password: z.string().min(8, "At least 8 characters").max(200),
});

/** The only thing a stranger can do with an invitation link: join with it. */
export async function joinAction(token: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = joinSchema.safeParse({
        firstName: str(formData, "firstName"),
        lastName: str(formData, "lastName"),
        mobile: str(formData, "mobile"),
        password: formData.get("password") ?? "",
    });
    if (!parsed.success) return fromZod(parsed.error);
    let joined: { userId: string; tenantId: string; slug: string };
    try {
        joined = await acceptInvitation(token, parsed.data);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That did not work" };
    }
    await createSession(joined.userId, null, (await headers()).get("user-agent"));
    redirect(`/${joined.slug}/dashboard`);
}
