import "server-only";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { bookingError, handOverError, isOverdue, returnError } from "@/lib/loans/rules";

/**
 * Courtesy cars against the database. The clash check re-reads the other loans
 * inside the transaction, so two people booking the same car at the same
 * moment cannot both succeed.
 */

export async function bookLoan(
    tx: TenantTx,
    tenantId: string,
    membershipId: string,
    input: { loanVehicleId: string; customerId: string | null; documentId: string | null; outAt: Date; dueBackAt: Date; note?: string | null },
): Promise<string> {
    const vehicle = await tx.loanVehicle.findUnique({ where: { id: input.loanVehicleId }, select: { id: true, active: true, plate: true } });
    if (!vehicle) throw new Error("That courtesy car is no longer there.");
    if (!vehicle.active) throw new Error(`${vehicle.plate} is off the road.`);
    const existing = await tx.loan.findMany({
        where: { loanVehicleId: vehicle.id, state: { in: ["BOOKED", "OUT"] } },
        select: { outAt: true, dueBackAt: true, inAt: true },
    });
    const problem = bookingError({ outAt: input.outAt, dueBackAt: input.dueBackAt }, existing);
    if (problem) throw new Error(problem);
    const loan = await tx.loan.create({
        data: {
            tenantId, loanVehicleId: vehicle.id, customerId: input.customerId, documentId: input.documentId,
            outAt: input.outAt, dueBackAt: input.dueBackAt, note: input.note ?? null, createdById: membershipId,
        },
        select: { id: true },
    });
    return loan.id;
}

export async function handOver(tx: TenantTx, loanId: string, odometerOut: number | null, agreedBy: string | null): Promise<void> {
    const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { state: true, loanVehicleId: true } });
    if (!loan) throw new Error("That loan is no longer there.");
    const problem = handOverError(loan.state);
    if (problem) throw new Error(problem);
    await tx.loan.update({ where: { id: loanId }, data: { state: "OUT", odometerOut, agreedBy: agreedBy?.trim().slice(0, 120) || null, outAt: new Date() } });
    if (odometerOut !== null) await tx.loanVehicle.update({ where: { id: loan.loanVehicleId }, data: { odometer: odometerOut } });
}

export async function takeBack(tx: TenantTx, loanId: string, odometerIn: number | null, note: string | null, now = new Date()): Promise<void> {
    const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { state: true, outAt: true, odometerOut: true, loanVehicleId: true, note: true } });
    if (!loan) throw new Error("That loan is no longer there.");
    const problem = returnError(loan.state, loan.outAt, now, loan.odometerOut, odometerIn);
    if (problem) throw new Error(problem);
    await tx.loan.update({
        where: { id: loanId },
        data: { state: "RETURNED", inAt: now, odometerIn, note: note?.trim() ? [loan.note, note.trim()].filter(Boolean).join(" · ") : loan.note },
    });
    if (odometerIn !== null) await tx.loanVehicle.update({ where: { id: loan.loanVehicleId }, data: { odometer: odometerIn } });
}

export async function cancelLoan(tx: TenantTx, loanId: string): Promise<void> {
    const loan = await tx.loan.findUnique({ where: { id: loanId }, select: { state: true } });
    if (!loan) return;
    if (loan.state === "OUT") throw new Error("That car is out. Take it back rather than cancelling.");
    if (loan.state === "RETURNED") throw new Error("That loan is finished.");
    await tx.loan.update({ where: { id: loanId }, data: { state: "CANCELLED" } });
}

const LOAN_SELECT = {
    id: true, state: true, outAt: true, dueBackAt: true, inAt: true, odometerOut: true, odometerIn: true, agreedBy: true, note: true,
    customer: { select: { id: true, firstName: true, lastName: true, mobile: true } },
    document: { select: { id: true, jobNumber: true, number: true } },
} as const;

/** Every courtesy car, with whoever has it now and what is booked next. */
export async function loanFleet(db: TenantDb, now: Date = new Date()) {
    const vehicles = await db.loanVehicle.findMany({
        orderBy: [{ active: "desc" }, { plate: "asc" }],
        select: {
            id: true, plate: true, make: true, model: true, year: true, colour: true, odometer: true, active: true,
            licenceExpiry: true, insuranceExpiry: true, note: true,
            loans: { where: { state: { in: ["BOOKED", "OUT"] } }, orderBy: { outAt: "asc" }, select: LOAN_SELECT },
        },
    });
    return vehicles.map((v) => {
        const out = v.loans.find((l) => l.state === "OUT") ?? null;
        const next = v.loans.find((l) => l.state === "BOOKED") ?? null;
        return {
            ...v,
            out,
            next,
            overdue: out ? isOverdue({ state: "OUT", dueBackAt: out.dueBackAt }, now) : false,
        };
    });
}

export async function loanHistory(db: TenantDb, loanVehicleId: string, take = 30) {
    return db.loan.findMany({ where: { loanVehicleId }, orderBy: { outAt: "desc" }, take, select: LOAN_SELECT });
}

export async function loansForDocument(db: TenantDb, documentId: string) {
    return db.loan.findMany({
        where: { documentId },
        orderBy: { outAt: "desc" },
        select: { ...LOAN_SELECT, vehicle: { select: { id: true, plate: true, make: true, model: true } } },
    });
}
