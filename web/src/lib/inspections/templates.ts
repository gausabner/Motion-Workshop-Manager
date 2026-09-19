import "server-only";
import { Prisma } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { flatten, freeName, toGroups, type TemplateDraft } from "@/lib/inspections/template-rules";

/**
 * Inspection templates (R5). Editing one never touches an inspection already
 * done: inspections copy the checks when they start. Check ids are kept across
 * saves so each copied check still says which template check it came from.
 */

export async function listTemplates(db: TenantDb) {
    const rows = await db.inspectionTemplate.findMany({
        orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, active: true, _count: { select: { items: true, inspections: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, active: r.active, checks: r._count.items, used: r._count.inspections }));
}

export async function getTemplateDraft(db: TenantTx, id: string) {
    const template = await db.inspectionTemplate.findUnique({
        where: { id },
        select: {
            id: true, name: true, active: true, _count: { select: { inspections: true } },
            items: { select: { id: true, group: true, ordering: true, description: true, inputLabels: true, productId: true, defaultEstimate: true } },
        },
    });
    if (!template) return null;
    return {
        id: template.id, active: template.active, used: template._count.inspections,
        draft: { name: template.name, groups: toGroups(template.items.map((i) => ({ ...i, defaultEstimate: i.defaultEstimate?.toNumber() ?? null }))) } satisfies TemplateDraft,
    };
}

/** Products a check can become, labour and sublet first because that is what inspection work usually is. */
export async function templateProducts(db: TenantDb) {
    const rows = await db.product.findMany({
        where: { archivedAt: null },
        orderBy: [{ type: "asc" }, { description: "asc" }],
        select: { id: true, itemCode: true, description: true, type: true, retailPrice: true },
    });
    const rank = (t: string) => (t === "LABOUR" ? 0 : t === "SUBLET" ? 1 : 2);
    return rows
        .sort((a, b) => rank(a.type) - rank(b.type))
        .map((p) => ({ id: p.id, label: `${p.itemCode} · ${p.description}`, type: p.type, price: p.retailPrice.toNumber() }));
}

const nameTaken = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export async function saveTemplate(tx: TenantTx, tenantId: string, id: string | null, draft: TemplateDraft): Promise<string> {
    const rows = flatten(draft);
    // A product id from the browser must be one of this workshop's.
    const productIds = [...new Set(rows.map((r) => r.productId).filter((p): p is string => !!p))];
    const known = new Set((await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id));
    const unknown = productIds.filter((p) => !known.has(p));
    if (unknown.length) throw new Error("One of the linked products is no longer there. Pick it again.");

    // Checked here as well as by the unique index, which cares about case and the mechanic choosing a template does not.
    const clash = await tx.inspectionTemplate.findFirst({ where: { name: { equals: draft.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new Error(`There is already a template called "${draft.name}"`);

    let templateId = id;
    try {
        if (templateId) {
            const existing = await tx.inspectionTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
            if (!existing) throw new Error("That template is no longer there");
            await tx.inspectionTemplate.update({ where: { id: templateId }, data: { name: draft.name } });
        } else {
            const last = await tx.inspectionTemplate.aggregate({ _max: { sortOrder: true } });
            templateId = (await tx.inspectionTemplate.create({ data: { tenantId, name: draft.name, sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true } })).id;
        }
    } catch (e) {
        if (nameTaken(e)) throw new Error(`There is already a template called "${draft.name}"`);
        throw e;
    }

    const current = new Set((await tx.inspectionTemplateItem.findMany({ where: { templateId }, select: { id: true } })).map((r) => r.id));
    // Ids that are not this template's own (pasted from elsewhere) are treated as new checks.
    const kept = new Set(rows.map((r) => r.id).filter((x): x is string => !!x && current.has(x)));
    await tx.inspectionTemplateItem.deleteMany({ where: { templateId, id: { notIn: [...kept] } } });
    for (const row of rows) {
        const data = {
            group: row.group, ordering: row.ordering, description: row.description, inputLabels: row.inputLabels,
            productId: row.productId, defaultEstimate: row.defaultEstimate,
        };
        if (row.id && kept.has(row.id)) await tx.inspectionTemplateItem.update({ where: { id: row.id }, data });
        else await tx.inspectionTemplateItem.create({ data: { ...data, tenantId, templateId } });
    }
    return templateId;
}

export async function duplicateTemplate(tx: TenantTx, tenantId: string, id: string): Promise<string> {
    const source = await getTemplateDraft(tx, id);
    if (!source) throw new Error("That template is no longer there");
    const names = (await tx.inspectionTemplate.findMany({ select: { name: true } })).map((t) => t.name);
    const copy: TemplateDraft = {
        name: freeName(`Copy of ${source.draft.name}`.slice(0, 80), names),
        groups: source.draft.groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, id: undefined })) })),
    };
    return saveTemplate(tx, tenantId, null, copy);
}

/** Switched-off templates stay on old inspections; they just cannot start new ones. One must stay on. */
export async function setTemplateActive(tx: TenantTx, id: string, active: boolean): Promise<void> {
    if (!active) {
        const others = await tx.inspectionTemplate.count({ where: { active: true, id: { not: id } } });
        if (others === 0) throw new Error("Keep at least one template switched on, or nobody can start an inspection.");
    }
    await tx.inspectionTemplate.update({ where: { id }, data: { active } });
}

/** Only a template nobody has used can go; a used one is switched off instead, so its inspections keep their origin. */
export async function deleteTemplate(tx: TenantTx, id: string): Promise<void> {
    const template = await tx.inspectionTemplate.findUnique({ where: { id }, select: { active: true, _count: { select: { inspections: true } } } });
    if (!template) return;
    if (template._count.inspections > 0) throw new Error("This template has been used, so it cannot be deleted. Switch it off instead.");
    if (template.active && (await tx.inspectionTemplate.count({ where: { active: true, id: { not: id } } })) === 0) {
        throw new Error("This is the only template switched on. Make or switch on another first.");
    }
    await tx.inspectionTemplate.delete({ where: { id } });
}
