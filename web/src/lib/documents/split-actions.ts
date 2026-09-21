"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { recalculate } from "@/lib/documents/recalculate";
import { allocateNumber } from "@/lib/documents/numbering";
import { excessError, reworkError, splitByExcess, splitError } from "@/lib/documents/split";

/**
 * Splitting a job between payers, and redoing one that came back.
 *
 * A split leaves the original where it is and takes a second document off it,
 * linked both ways, so the whole job can still be seen from either side.
 */

const editorPath = (slug: string, id: string) => `/${slug}/dashboard/documents/${id}`;

const splitSchema = z.object({
    customerId: z.string().min(1, "Choose who the other half is billed to"),
    lineIds: z.array(z.string().min(1)).default([]),
    excess: z.union([z.literal(""), z.coerce.number()]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
    mode: z.enum(["lines", "excess"]),
});

async function splitter(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    return ctx;
}

export async function splitDocumentAction(slug: string, id: string, input: unknown): Promise<{ ok: false; message: string }> {
    const { db, tenant, membership, user } = await splitter(slug);
    const parsed = splitSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the split" };
    const { customerId, lineIds, excess, mode } = parsed.data;

    const doc = await db.document.findUnique({
        where: { id },
        include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!doc) return { ok: false, message: "That document is no longer there." };
    const problem = splitError(doc.state, doc.type, doc.lines.length);
    if (problem) return { ok: false, message: problem };

    const payer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!payer) return { ok: false, message: "That customer is no longer there." };
    if (mode === "excess" && excess !== null) {
        const wrong = excessError(doc.total.toNumber(), excess);
        if (wrong) return { ok: false, message: wrong };
    }

    let newId: string;
    try {
        newId = await db.$transaction(async (tx) => {
            const created = await tx.document.create({
                data: {
                    tenantId: tenant.id, type: "INVOICE", state: "DRAFT", customerId: payer.id, vehicleId: doc.vehicleId,
                    jobNumber: doc.jobNumber, postDate: doc.postDate, reference: doc.reference,
                    description: doc.description, serviceAdvisorId: doc.serviceAdvisorId, mechanicId: doc.mechanicId,
                    taxName: doc.taxName, taxRate: doc.taxRate, pricesIncludeTax: doc.pricesIncludeTax,
                    paymentTermsDays: doc.paymentTermsDays, createdById: membership.id, splitFromId: doc.id,
                },
                select: { id: true },
            });

            if (mode === "lines") {
                const moving = doc.lines.filter((l) => lineIds.includes(l.id));
                if (moving.length === 0) throw new Error("Choose the lines the other payer is taking.");
                if (moving.length === doc.lines.length) throw new Error("That would move everything. Change the customer on this document instead.");
                for (const [index, line] of moving.entries()) {
                    await tx.documentLine.update({ where: { id: line.id }, data: { documentId: created.id, sortOrder: index } });
                }
            } else {
                // The insurer pays the job less the excess; the customer keeps the excess on the original.
                const { toPayer } = splitByExcess(doc.total.toNumber(), excess ?? 0);
                const jobRef = doc.jobNumber ?? doc.number ?? "this job";
                await tx.documentLine.create({
                    data: {
                        tenantId: tenant.id, documentId: created.id, sortOrder: 0, lineType: "LABOUR",
                        description: `Repairs on ${jobRef}, less the excess`,
                        quantity: 1, unitPrice: toPayer, unitCost: 0, vatRate: 0, discountPercent: 0,
                    },
                });
                await tx.documentLine.create({
                    data: {
                        tenantId: tenant.id, documentId: doc.id, sortOrder: doc.lines.length, lineType: "LABOUR",
                        description: `Less: billed to the other payer on the split invoice`,
                        quantity: 1, unitPrice: -toPayer, unitCost: 0, vatRate: 0, discountPercent: 0,
                    },
                });
            }

            await recalculate(tx, doc.id);
            await recalculate(tx, created.id);
            await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: doc.id, action: "SPLIT", diff: { into: created.id, mode } } });
            return created.id;
        });
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The split was not made" };
    }

    revalidatePath(editorPath(slug, id));
    revalidatePath(`/${slug}/dashboard/transactions`);
    redirect(editorPath(slug, newId));
}

/**
 * Redo work that came back. The rework is a job card of its own, linked to
 * what it redoes and marked internal — a comeback is not a sale, and counting
 * it as one hides exactly the thing worth watching.
 */
export async function reworkDocumentAction(slug: string, id: string, reason: string): Promise<{ ok: false; message: string }> {
    const { db, tenant, membership, user } = await splitter(slug);
    if (!reason.trim()) return { ok: false, message: "Say what came back, so the pattern can be seen later." };

    const doc = await db.document.findUnique({
        where: { id },
        select: { id: true, type: true, state: true, customerId: true, vehicleId: true, number: true, jobNumber: true, odometer: true, serviceAdvisorId: true, mechanicId: true, taxName: true, taxRate: true, pricesIncludeTax: true },
    });
    if (!doc) return { ok: false, message: "That document is no longer there." };
    const problem = reworkError(doc.state, doc.type);
    if (problem) return { ok: false, message: problem };

    const created = await db.$transaction(async (tx) => {
        const jobNumber = await allocateNumber(tx, tenant.id, "JOB");
        const row = await tx.document.create({
            data: {
                tenantId: tenant.id, type: "JOB_CARD", state: "DRAFT", jobStatus: "BOOKED_IN",
                customerId: doc.customerId, vehicleId: doc.vehicleId, jobNumber, postDate: new Date(),
                description: `Rework of ${doc.jobNumber ?? doc.number ?? "an earlier job"}`,
                odometer: doc.odometer, serviceAdvisorId: doc.serviceAdvisorId, mechanicId: doc.mechanicId,
                taxName: doc.taxName, taxRate: doc.taxRate, pricesIncludeTax: doc.pricesIncludeTax,
                createdById: membership.id, reworkOfId: doc.id, reworkReason: reason.trim().slice(0, 500),
                // A comeback is not a sale. It stays out of the figures, which is what makes rework worth measuring.
                isInternal: true,
                jobCardNotes: `Came back on ${doc.jobNumber ?? doc.number ?? ""}: ${reason.trim()}`,
            },
            select: { id: true },
        });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: doc.id, action: "REWORKED", diff: { into: row.id, reason } } });
        return row.id;
    });

    revalidatePath(editorPath(slug, id));
    revalidatePath(`/${slug}/dashboard/jobs`);
    redirect(editorPath(slug, created));
}
