"use server";

import { revalidatePath } from "next/cache";
import { inspectionForToken } from "@/lib/inspections/public";
import { decideAndBook } from "@/lib/inspections/service";

/**
 * The customer's two actions, authorised by the link they were sent and
 * nothing else. The finding must belong to the inspection the token was
 * minted for — a token for one inspection cannot touch another's findings.
 */
export async function answerFinding(token: string, itemId: string, answer: "approve" | "decline" | "clear"): Promise<{ ok: boolean; message?: string; booked?: boolean }> {
    const found = await inspectionForToken(token);
    if (!found.ok) return { ok: false, message: "This link no longer works. Please ask the workshop to send it again." };
    if (!found.inspection.items.some((i) => i.id === itemId)) return { ok: false, message: "That is not part of this inspection." };
    let booked = false;
    try {
        const r = await found.db.$transaction((tx) => decideAndBook(tx, found.inspection.id, itemId, answer, "customer"));
        booked = r.added > 0;
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That did not save. Please try again." };
    }
    revalidatePath(`/approve/${token}`);
    revalidatePath(`/${found.tenant.slug}/dashboard/inspections/${found.inspection.id}`);
    return { ok: true, booked };
}

export async function sendComment(token: string, text: string): Promise<{ ok: boolean; message?: string }> {
    const found = await inspectionForToken(token);
    if (!found.ok) return { ok: false, message: "This link no longer works." };
    const body = text.trim().slice(0, 1000);
    if (!body) return { ok: false, message: "Write something first." };
    // Kept, not replaced: an earlier message is still part of the conversation.
    const previous = found.inspection.customerComments;
    await found.db.inspection.update({ where: { id: found.inspection.id }, data: { customerComments: previous ? `${previous}\n\n${body}` : body } });
    revalidatePath(`/${found.tenant.slug}/dashboard/inspections/${found.inspection.id}`);
    return { ok: true };
}
