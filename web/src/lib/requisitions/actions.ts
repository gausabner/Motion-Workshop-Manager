"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFeature } from "@/lib/auth/session";
import { assertCan, can } from "@/lib/auth/permissions";
import { str } from "@/lib/forms";
import {
    cancelRequisition,
    decideRequisition,
    deleteDraft,
    finaliseRequisition,
    saveRequisition,
    submitRequisition,
    withdrawRequisition,
    type FinalStep,
} from "@/lib/requisitions/service";
import { issueStores } from "@/lib/requisitions/stores";
import { orderFromRequisition, requestQuotes, splitToPurchase } from "@/lib/requisitions/purchase";
import { addQuote, chooseQuote, removeQuote } from "@/lib/requisitions/service";
import { storeUpload } from "@/lib/attachments/service";
import { requestOrigin } from "@/lib/http/origin";
import { shareUrl } from "@/lib/sharing/links";
import { requisitionView, type RequisitionAnswer } from "@/lib/requisitions/view";

/**
 * Requisitions as their screens drive them. Every action answers with the
 * requisition as it now stands, and the screen shows that: a production
 * build of Next 16.1 does not reliably show a page refreshed after an action
 * (see `lib/fleet/actions.ts`), and an answer is one round trip anyway.
 * Raising one, or throwing a draft away, goes somewhere new, so those
 * navigate.
 *
 * Who may do what is decided in the service, by appointment and designation;
 * the role checks here are the coarse gate.
 */

const LIST = (slug: string) => `/${slug}/dashboard/requisitions`;

async function ctx(slug: string) {
    const c = await requireFeature(slug, "requisitions");
    const actor = {
        membershipId: c.membership.id,
        userId: c.user.id,
        canManage: can(c.membership, "settings:manage"),
        canIssue: can(c.membership, "requisitions:issue"),
    };
    return { ...c, actor };
}

async function answer(slug: string, id: string, done: string, run: (c: Awaited<ReturnType<typeof ctx>>) => Promise<unknown>): Promise<RequisitionAnswer> {
    const c = await ctx(slug);
    try {
        await run(c);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not done. Try again." };
    }
    const view = await requisitionView(c.db, c.tenant, id, c.membership);
    return { ok: true, message: done, view: view ?? undefined };
}

// ───────────────────────── raising ─────────────────────────

/** "Request parts" on a job card: a stores requisition charged to the job, from the workshop the vehicle is in. */
export async function raiseForJobAction(slug: string, documentId: string): Promise<RequisitionAnswer> {
    const c = await ctx(slug);
    assertCan(c.membership, "requisitions:raise");
    let id: string;
    try {
        id = await c.db.$transaction(async (tx) => {
            // A second tap opens the empty draft the first one made, rather than leaving a trail of them.
            const empty = await tx.requisition.findFirst({ where: { chargeDocumentId: documentId, requestedById: c.membership.id, state: "DRAFT", number: null, lines: { none: {} } }, orderBy: { createdAt: "desc" }, select: { id: true } });
            if (empty) return empty.id;
            const job = await tx.document.findFirst({ where: { id: documentId }, select: { jobNumber: true, number: true } });
            // Where the vehicle is now, if it is in a workshop: that is who is asking.
            const here = await tx.jobVisit.findFirst({ where: { documentId, leftAt: null }, select: { workshopId: true, workshop: { select: { kind: true } } } });
            const workshopId = here && (here.workshop.kind === "WORKSHOP" || here.workshop.kind === "BAY") ? here.workshopId : null;
            return saveRequisition(tx, c.tenant, c.actor, null, {
                kind: "STORES", workshopId, chargeDocumentId: documentId, chargeVoteId: null,
                purpose: job ? `Parts for ${job.jobNumber ?? job.number}` : null, lines: [],
            });
        });
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not raised. Try again." };
    }
    redirect(`${LIST(slug)}/${id}`);
}

/** A stores requisition not tied to a job: protective clothing, workshop consumables, charged to a vote. */
/** From the list: a stores requisition, or a purchase requisition for something stores does not keep. */
export async function raiseAction(slug: string, kind: "STORES" | "PURCHASE" = "STORES"): Promise<RequisitionAnswer> {
    const c = await ctx(slug);
    assertCan(c.membership, "requisitions:raise");
    const id = await c.db.$transaction((tx) => saveRequisition(tx, c.tenant, c.actor, null, { kind: kind === "PURCHASE" ? "PURCHASE" : "STORES", workshopId: null, chargeDocumentId: null, chargeVoteId: null, lines: [] }));
    redirect(`${LIST(slug)}/${id}`);
}

const lineSchema = z.object({
    productId: z.string().max(40).nullable(),
    description: z.string().trim().min(1, "Every line needs a description.").max(200),
    quantity: z.number().positive("Every line needs a quantity above nothing.").max(100_000),
    unitCost: z.number().min(0).max(10_000_000),
    note: z.string().max(200).nullable().optional(),
});

/** The draft's header and lines, as the screen holds them. */
export async function saveRequisitionAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    let lines: z.infer<typeof lineSchema>[];
    try {
        const parsed = z.array(lineSchema).max(60).safeParse(JSON.parse(String(formData.get("lines") ?? "[]")));
        if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the lines." };
        lines = parsed.data;
    } catch {
        return { ok: false, message: "The lines could not be read. Reload the page and try again." };
    }
    const charge = str(formData, "charge") ?? "";
    const [chargeKind, chargeId] = charge.split(":");
    return answer(slug, id, "Saved", ({ db, tenant, actor }) =>
        db.$transaction(async (tx) => {
            const kind = (await tx.requisition.findUnique({ where: { id }, select: { kind: true } }))?.kind ?? "STORES";
            return saveRequisition(tx, tenant, actor, id, {
                kind,
                workshopId: str(formData, "workshopId") ?? null,
                location: str(formData, "location") ?? null,
                requiredBy: str(formData, "requiredBy") ?? null,
                purpose: str(formData, "purpose") ?? null,
                chargeDocumentId: chargeKind === "JOB" ? chargeId || null : null,
                chargeVoteId: chargeKind === "VOTE" ? chargeId || null : null,
                lines: lines.map((l) => ({ ...l, note: l.note ?? null })),
            });
        }),
    );
}

export async function submitRequisitionAction(slug: string, id: string): Promise<RequisitionAnswer> {
    return answer(slug, id, "Submitted", ({ db, tenant, actor }) => db.$transaction((tx) => submitRequisition(tx, tenant, actor, id)));
}

export async function discardRequisitionAction(slug: string, id: string): Promise<RequisitionAnswer> {
    const c = await ctx(slug);
    try {
        await c.db.$transaction((tx) => deleteDraft(tx, c.tenant, c.actor, id));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not discarded. Try again." };
    }
    redirect(LIST(slug));
}

export async function withdrawRequisitionAction(slug: string, id: string): Promise<RequisitionAnswer> {
    return answer(slug, id, "Withdrawn. Change it and submit it again.", ({ db, tenant, actor }) => db.$transaction((tx) => withdrawRequisition(tx, tenant, actor, id)));
}

// ───────────────────────── approving ─────────────────────────

export async function decideRequisitionAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    const decision = z.enum(["APPROVED", "RETURNED", "REJECTED"]).safeParse(str(formData, "decision"));
    if (!decision.success) return { ok: false, message: "Approve, return or reject it." };
    const done = decision.data === "APPROVED" ? "Approved" : decision.data === "RETURNED" ? "Returned for changes" : "Rejected";
    return answer(slug, id, done, ({ db, tenant, actor }) => db.$transaction((tx) => decideRequisition(tx, tenant, actor, id, decision.data, str(formData, "comment") ?? null)));
}

export async function cancelRequisitionAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    return answer(slug, id, "Cancelled", ({ db, tenant, actor }) => db.$transaction((tx) => cancelRequisition(tx, tenant, actor, id, str(formData, "reason") ?? "")));
}

// ───────────────────────── stores ─────────────────────────

/** Stores hands parts over: quantities per line, and the receiver, a team member or a name and pay number. */
export async function issueRequisitionAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    const lines = [...formData.entries()]
        .filter(([k]) => k.startsWith("issue:"))
        .map(([k, v]) => ({ lineId: k.slice(6), quantity: Number(String(v).replace(",", ".")) || 0 }));
    if (lines.some((l) => l.quantity < 0)) return { ok: false, message: "A quantity cannot be below nothing." };
    const receiver = { membershipId: str(formData, "receiverId") ?? null, name: str(formData, "receiverName") ?? null, payNumber: str(formData, "receiverPayNumber") ?? null };
    return answer(slug, id, "Issued", ({ db, tenant, actor }) => db.$transaction((tx) => issueStores(tx, tenant, actor, id, { lines, receiver, note: str(formData, "note") ?? null })));
}

// ───────────────────────── finalising ─────────────────────────

const FINAL = z.enum(["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD", "FINAL_FITTER"]);

export async function finaliseRequisitionAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    const step = FINAL.safeParse(str(formData, "step"));
    if (!step.success) return { ok: false, message: "Choose the box you are signing." };
    return answer(slug, id, "Signed", ({ db, tenant, actor }) => db.$transaction((tx) => finaliseRequisition(tx, tenant, actor, id, step.data as FinalStep, str(formData, "comment") ?? null)));
}

// ───────────────────────── buying ─────────────────────────

/** Stores turns what the shelf cannot meet into a purchase requisition, and goes to it. */
export async function splitRequisitionAction(slug: string, id: string): Promise<RequisitionAnswer> {
    const c = await ctx(slug);
    let made: { id: string };
    try {
        made = await c.db.$transaction((tx) => splitToPurchase(tx, c.tenant, c.actor, id));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not split. Try again." };
    }
    redirect(`${LIST(slug)}/${made.id}`);
}

const quoteSchema = z.object({
    supplierId: z.string().min(1, "Choose the supplier who quoted.").max(40),
    amount: z.number({ message: "Enter the quotation's amount, excluding VAT." }).positive("Enter the quotation's amount, excluding VAT.").max(100_000_000),
    reference: z.string().trim().max(60).nullable(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    note: z.string().trim().max(200).nullable(),
});

/** A quotation brought back, with its scan if there is one. The scan is stored after the quotation, so a failed upload loses only the file. */
export async function addQuoteAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    const amount = Number(String(formData.get("amount") ?? "").replace(/[\s,]/g, "").replace(/^N\$|^R/, ""));
    const parsed = quoteSchema.safeParse({
        supplierId: str(formData, "supplierId") ?? "", amount: Number.isFinite(amount) ? amount : NaN,
        reference: str(formData, "reference") ?? null, validUntil: str(formData, "validUntil") ?? null, note: str(formData, "note") ?? null,
    });
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the quotation." };
    const file = formData.get("scan");
    let scanProblem: string | null = null;
    const answered = await answer(slug, id, "Quotation added", async (c) => {
        const quoteId = await c.db.$transaction((tx) => addQuote(tx, c.tenant, c.actor, id, parsed.data));
        if (file instanceof File && file.size > 0) {
            const stored = await storeUpload(c, file, { ownerType: "RequisitionQuote", ownerId: quoteId });
            if (!stored.ok) scanProblem = stored.message;
        }
    });
    return scanProblem ? { ...answered, message: `Quotation added, but its scan was not: ${scanProblem}` } : answered;
}

export async function removeQuoteAction(slug: string, id: string, quoteId: string): Promise<RequisitionAnswer> {
    return answer(slug, id, "Quotation removed", ({ db, tenant, actor }) => db.$transaction((tx) => removeQuote(tx, tenant, actor, quoteId)));
}

export async function chooseQuoteAction(slug: string, id: string, quoteId: string): Promise<RequisitionAnswer> {
    return answer(slug, id, "Quotation chosen", ({ db, tenant, actor }) => db.$transaction((tx) => chooseQuote(tx, tenant, actor, quoteId)));
}

/**
 * Ask suppliers for a price. Each gets a link to the request, without prices;
 * the answer carries one email per supplier for the person to send from their
 * own mail, as every MOTION message goes.
 */
export async function requestQuotesAction(slug: string, id: string, _prev: RequisitionAnswer, formData: FormData): Promise<RequisitionAnswer> {
    const supplierIds = formData.getAll("supplierId").map(String).filter(Boolean);
    let made: Awaited<ReturnType<typeof requestQuotes>> = [];
    const answered = await answer(slug, id, "Requests ready to send", async ({ db, tenant, actor }) => {
        made = await db.$transaction((tx) => requestQuotes(tx, tenant, actor, id, supplierIds));
    });
    if (!answered.ok || !answered.view) return answered;
    const origin = await requestOrigin();
    const view = answered.view;
    const c = await ctx(slug);
    const subject = `Request for quotation ${view.number ?? ""}`.trim();
    const emails = made.map((m) => {
        const body = [
            `Good day,`,
            ``,
            `${c.tenant.name} asks for your quotation for the items on requisition ${view.number ?? ""}${view.requiredBy ? `, needed by ${new Date(`${view.requiredBy}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}` : ""}:`,
            shareUrl(origin, m.token, "QUOTATION_REQUEST"),
            ``,
            `Please reply to this email with your price excluding VAT, how long it is valid, and your reference.`,
            ``,
            `Kind regards`,
        ].join("\n");
        return { supplier: m.name, email: m.email, href: `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
    });
    return { ...answered, emails };
}

/** The approved purchase requisition becomes a purchase order, ready to send from the order's page. */
export async function orderRequisitionAction(slug: string, id: string): Promise<RequisitionAnswer> {
    return answer(slug, id, "Purchase order raised. Send it from the order's page", ({ db, tenant, actor }) => db.$transaction((tx) => orderFromRequisition(tx, tenant, actor, id)));
}
