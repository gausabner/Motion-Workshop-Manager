import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { estimates } from "@/lib/inspections/rules";

/** An inspection as both the mechanic's editor and the customer's page draw it. Decimals are gone before it leaves here. */
export async function getInspection(db: TenantDb, id: string) {
    const inspection = await db.inspection.findUnique({
        where: { id },
        include: {
            items: { orderBy: { ordering: "asc" } },
            customer: { select: { id: true, firstName: true, lastName: true, mobile: true } },
            vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
            document: { select: { id: true, type: true, number: true, jobNumber: true, state: true } },
            mechanic: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
    });
    if (!inspection) return null;
    const photos = await db.attachment.findMany({
        where: { ownerType: "InspectionItem", ownerId: { in: inspection.items.map((i) => i.id) } },
        orderBy: { createdAt: "asc" },
        select: { id: true, ownerId: true, fileName: true },
    });
    const items = inspection.items.map((i) => ({
        id: i.id,
        group: i.group,
        description: i.description,
        inputLabels: Array.isArray(i.inputLabels) ? (i.inputLabels as string[]) : [],
        inputs: [i.input1, i.input2, i.input3, i.input4],
        comment: i.comment,
        urgent: i.urgent,
        soon: i.soon,
        checked: i.checked,
        estimate: i.estimate ? i.estimate.toNumber() : null,
        approvedAt: i.approvedAt,
        approvedBy: i.approvedBy,
        declinedAt: i.declinedAt,
        documentLineId: i.documentLineId,
        photos: photos.filter((p) => p.ownerId === i.id).map((p) => ({ id: p.id, fileName: p.fileName })),
    }));
    return {
        id: inspection.id,
        number: inspection.number,
        state: inspection.state,
        description: inspection.description,
        odometer: inspection.odometer,
        requestedAt: inspection.requestedAt,
        customerViewedAt: inspection.customerViewedAt,
        customerComments: inspection.customerComments,
        finalisedAt: inspection.finalisedAt,
        createdAt: inspection.createdAt,
        customer: inspection.customer,
        vehicle: inspection.vehicle,
        document: inspection.document,
        mechanic: inspection.mechanic ? `${inspection.mechanic.user.firstName} ${inspection.mechanic.user.lastName}` : null,
        items,
        totals: estimates(items),
    };
}

export type InspectionRecord = NonNullable<Awaited<ReturnType<typeof getInspection>>>;

export async function inspectionsForDocument(db: TenantDb, documentId: string) {
    const rows = await db.inspection.findMany({
        where: { documentId },
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, state: true, description: true, createdAt: true, items: { select: { urgent: true, soon: true, approvedAt: true, declinedAt: true, estimate: true, checked: true } } },
    });
    return rows.map((r) => ({
        id: r.id, number: r.number, state: r.state, description: r.description, createdAt: r.createdAt,
        red: r.items.filter((i) => i.urgent).length,
        amber: r.items.filter((i) => !i.urgent && i.soon).length,
        approved: r.items.filter((i) => i.approvedAt).length,
    }));
}
