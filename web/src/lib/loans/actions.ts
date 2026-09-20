"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { parseLocalDateTime } from "@/lib/diary/time";
import { bookLoan, cancelLoan, handOver, takeBack } from "@/lib/loans/service";

const path = (slug: string) => `/${slug}/dashboard/loan-cars`;
const optionalId = z.union([z.literal(""), z.string().max(40)]).nullish().transform((v) => (v ? v : null));
const optionalInt = z.union([z.literal(""), z.coerce.number().int().min(0).max(9_999_999)]).nullish().transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)));

const vehicleSchema = z.object({
    plate: z.string().trim().min(1, "A courtesy car needs a registration").max(20),
    make: z.string().trim().max(60).default(""),
    model: z.string().trim().max(60).default(""),
    year: optionalInt,
    colour: z.string().trim().max(40).nullish(),
    odometer: optionalInt,
    active: z.boolean().default(true),
    note: z.string().trim().max(300).nullish(),
});

const bookSchema = z.object({
    loanVehicleId: z.string().min(1, "Choose a car"),
    customerId: optionalId,
    documentId: optionalId,
    outAt: z.string().min(1, "When does it go out?"),
    dueBackAt: z.string().min(1, "When is it due back?"),
    note: z.string().trim().max(300).nullish(),
});

async function keeper(slug: string) {
    const ctx = await requireTenant(slug);
    // Lending a car is counter work, like booking a job.
    assertCan(ctx.membership, "documents:write");
    return ctx;
}

export async function saveLoanVehicleAction(slug: string, id: string | null, input: unknown): Promise<{ ok: boolean; message?: string }> {
    const { db, tenant } = await keeper(slug);
    const parsed = vehicleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details" };
    const data = { ...parsed.data, plate: parsed.data.plate.toUpperCase(), colour: parsed.data.colour ?? null, note: parsed.data.note ?? null };
    try {
        if (id) await db.loanVehicle.update({ where: { id }, data });
        else await db.loanVehicle.create({ data: { ...data, tenantId: tenant.id } });
    } catch {
        return { ok: false, message: `There is already a courtesy car with the registration ${data.plate}.` };
    }
    revalidatePath(path(slug));
    return { ok: true };
}

export async function bookLoanAction(slug: string, input: unknown): Promise<{ ok: boolean; message?: string }> {
    const { db, tenant, membership } = await keeper(slug);
    const parsed = bookSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the booking" };
    const outAt = parseLocalDateTime(parsed.data.outAt, tenant.timezone);
    const dueBackAt = parseLocalDateTime(parsed.data.dueBackAt, tenant.timezone);
    if (!outAt || !dueBackAt) return { ok: false, message: "Those dates were not understood." };
    try {
        await db.$transaction((tx) => bookLoan(tx, tenant.id, membership.id, { ...parsed.data, outAt, dueBackAt }));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not booked" };
    }
    revalidatePath(path(slug));
    if (parsed.data.documentId) revalidatePath(`/${slug}/dashboard/documents/${parsed.data.documentId}`);
    return { ok: true };
}

export async function handOverAction(slug: string, loanId: string, odometerOut: string, agreedBy: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await keeper(slug);
    try {
        await db.$transaction((tx) => handOver(tx, loanId, odometerOut.trim() === "" ? null : Number(odometerOut), agreedBy));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not handed over" };
    }
    revalidatePath(path(slug), "layout");
    return { ok: true };
}

export async function takeBackAction(slug: string, loanId: string, odometerIn: string, note: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await keeper(slug);
    try {
        await db.$transaction((tx) => takeBack(tx, loanId, odometerIn.trim() === "" ? null : Number(odometerIn), note));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not taken back" };
    }
    revalidatePath(path(slug), "layout");
    return { ok: true };
}

export async function cancelLoanAction(slug: string, loanId: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await keeper(slug);
    try {
        await db.$transaction((tx) => cancelLoan(tx, loanId));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not cancelled" };
    }
    revalidatePath(path(slug), "layout");
    return { ok: true };
}
