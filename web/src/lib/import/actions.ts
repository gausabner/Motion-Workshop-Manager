"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { readSheet, guessMapping } from "@/lib/import/csv";
import { ENTITIES, type ImportEntity } from "@/lib/import/entities";
import { analyse, duplicatesWithin, type RowProblem } from "@/lib/import/analyse";
import { runImport, type ImportResult } from "@/lib/import/service";

const entitySchema = z.enum(["customers", "vehicles", "products", "suppliers"]);
const MAX = 2_000_000;

export type Preview = {
    headers: string[];
    mapping: Record<string, string>;
    total: number;
    readyCount: number;
    sample: { line: number; cells: string[] }[];
    problems: RowProblem[];
    duplicates: RowProblem[];
    ignoredColumns: string[];
    missingRequired: string[];
};

async function importer(slug: string) {
    const ctx = await requireTenant(slug);
    // Importing writes customers, vehicles and products at once; only a manager should.
    assertCan(ctx.membership, "settings:manage");
    return ctx;
}

/** Read the file and say what would happen — the benchmark's analyse-then-import, with the reasons shown. */
export async function analyseFileAction(slug: string, entity: string, text: string, mapping?: Record<string, string>): Promise<{ ok: false; message: string } | { ok: true; preview: Preview }> {
    await importer(slug);
    const kind = entitySchema.safeParse(entity);
    if (!kind.success) return { ok: false, message: "Choose what the file holds." };
    if (text.length > MAX) return { ok: false, message: "That file is larger than 2 MB. Split it and import in parts." };
    const sheet = readSheet(text);
    if (sheet.headers.length === 0) return { ok: false, message: "That file has no column names on its first line." };

    const spec = ENTITIES[kind.data];
    const chosen = mapping && Object.keys(mapping).length > 0 ? mapping : guessMapping(sheet.headers, spec.fields.map((f) => ({ key: f.key, aliases: f.aliases })));
    const result = analyse(kind.data, sheet.headers, sheet.rows, chosen);
    const mappedColumns = spec.fields.map((f) => chosen[f.key]).filter(Boolean);

    return {
        ok: true,
        preview: {
            headers: sheet.headers,
            mapping: chosen,
            total: result.total,
            readyCount: result.ready.length,
            sample: sheet.rows.slice(0, 8).map((row, i) => ({ line: i + 2, cells: mappedColumns.map((c) => row[c] ?? "") })),
            problems: result.problems.slice(0, 50),
            duplicates: duplicatesWithin(kind.data, result.ready).slice(0, 20),
            ignoredColumns: result.ignoredColumns,
            missingRequired: result.missingRequired,
        },
    };
}

export async function importFileAction(slug: string, entity: string, text: string, mapping: Record<string, string>): Promise<{ ok: false; message: string } | { ok: true; result: ImportResult }> {
    const { db, tenant, user } = await importer(slug);
    const kind = entitySchema.safeParse(entity);
    if (!kind.success) return { ok: false, message: "Choose what the file holds." };
    const sheet = readSheet(text);
    const result = analyse(kind.data, sheet.headers, sheet.rows, mapping);
    if (result.missingRequired.length > 0) return { ok: false, message: `The file still needs a column for: ${result.missingRequired.join(", ")}.` };
    if (result.ready.length === 0) return { ok: false, message: "No row in that file can be imported yet." };

    const written = await runImport(db, tenant, kind.data as ImportEntity, result.ready);
    await db.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Import", entityId: kind.data, action: "IMPORTED", diff: { ...written, problems: written.problems.length } },
    });
    for (const path of ["customers", "vehicles", "products", "suppliers"]) revalidatePath(`/${slug}/dashboard/${path}`);
    return { ok: true, result: { ...written, problems: [...result.problems, ...written.problems].slice(0, 50) } };
}
