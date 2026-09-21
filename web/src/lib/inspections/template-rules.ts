import { z } from "zod";

/**
 * An inspection template as the builder edits it: named groups of checks, in
 * order. Stored flat — one row per check with its group name and a running
 * `ordering` — because that is what an inspection copies. Pure, so the
 * round trip between the two shapes is tested without a database.
 */

const label = z.string().trim().min(1).max(20);

export const templateItemSchema = z.object({
    /** Present for a check that already exists; kept so old inspections still point at it. */
    id: z.string().min(1).max(40).optional(),
    description: z.string().trim().min(1, "Every check needs a name").max(160, "Keep a check under 160 characters"),
    inputs: z.array(label).max(4, "Up to four readings per check"),
    productId: z.string().min(1).max(40).nullable(),
    defaultEstimate: z.number().min(0, "A price cannot be negative").max(1_000_000).nullable(),
});

export const templateDraftSchema = z.object({
    name: z.string().trim().min(2, "Give the template a name").max(80),
    groups: z.array(z.object({
        name: z.string().trim().min(1, "Every group needs a name").max(60),
        items: z.array(templateItemSchema).min(1, "A group needs at least one check"),
    })).min(1, "Add at least one group"),
}).superRefine((draft, ctx) => {
    const seen = new Set<string>();
    draft.groups.forEach((g, i) => {
        const key = g.name.toLowerCase();
        if (seen.has(key)) ctx.addIssue({ code: "custom", message: `Two groups are called "${g.name}"`, path: ["groups", i, "name"] });
        seen.add(key);
    });
    const count = draft.groups.reduce((n, g) => n + g.items.length, 0);
    if (count > 200) ctx.addIssue({ code: "custom", message: "Keep a template under 200 checks", path: ["groups"] });
    const ids = draft.groups.flatMap((g) => g.items.map((it) => it.id)).filter(Boolean);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "A check appears twice", path: ["groups"] });
});

export type TemplateDraft = z.infer<typeof templateDraftSchema>;
export type TemplateDraftItem = z.infer<typeof templateItemSchema>;

export type FlatItem = { id?: string; group: string; ordering: number; description: string; inputLabels: string[]; productId: string | null; defaultEstimate: number | null };

/** Groups → the rows an inspection copies, numbered in the order they appear. */
export function flatten(draft: TemplateDraft): FlatItem[] {
    let ordering = 0;
    return draft.groups.flatMap((g) =>
        g.items.map((it) => ({
            id: it.id, group: g.name, ordering: ordering++, description: it.description,
            inputLabels: it.inputs, productId: it.productId, defaultEstimate: it.defaultEstimate,
        })),
    );
}

/** Stored rows → groups, each group where its first check falls. */
export function toGroups(rows: { id: string; group: string; ordering: number; description: string; inputLabels: unknown; productId: string | null; defaultEstimate: number | null }[]): TemplateDraft["groups"] {
    const groups: TemplateDraft["groups"] = [];
    for (const row of [...rows].sort((a, b) => a.ordering - b.ordering)) {
        let group = groups.find((g) => g.name === row.group);
        if (!group) {
            group = { name: row.group, items: [] };
            groups.push(group);
        }
        group.items.push({
            id: row.id, description: row.description,
            inputs: Array.isArray(row.inputLabels) ? row.inputLabels.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
            productId: row.productId, defaultEstimate: row.defaultEstimate,
        });
    }
    return groups;
}

/** "Left mm, Right mm" ⇄ ["Left mm", "Right mm"], for the one text box the builder shows. */
export function parseReadings(text: string): string[] {
    return text.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

/** Move one entry up or down a list, returning a new list; out-of-range moves change nothing. */
export function move<T>(list: T[], index: number, by: -1 | 1): T[] {
    const to = index + by;
    if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
}

/** A name that is not taken yet, for "Copy of …". */
export function freeName(base: string, taken: string[]): string {
    const lower = new Set(taken.map((t) => t.toLowerCase()));
    if (!lower.has(base.toLowerCase())) return base;
    for (let n = 2; n < 100; n++) {
        const candidate = `${base} (${n})`;
        if (!lower.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${Date.now()}`;
}
