import type { LoanState } from "@prisma/client";

/**
 * Lending a courtesy car.
 *
 * The rules that matter are the ones a busy counter gets wrong: promising the
 * same car to two people, and losing track of one that should have come back.
 */

export type Period = { outAt: Date; dueBackAt: Date; inAt?: Date | null };

/** Two loans of one car clash when their periods overlap at all. */
export function overlaps(a: Period, b: Period): boolean {
    // A car that is back is only booked until it came back.
    const endA = a.inAt ?? a.dueBackAt;
    const endB = b.inAt ?? b.dueBackAt;
    return a.outAt < endB && b.outAt < endA;
}

export function bookingError(period: Period, existing: Period[]): string | null {
    if (period.dueBackAt <= period.outAt) return "It has to come back after it goes out.";
    if (existing.some((other) => overlaps(period, other))) return "That car is promised to somebody else over those days.";
    return null;
}

/** Out, and past when it was due. */
export function isOverdue(loan: { state: LoanState; dueBackAt: Date }, now: Date): boolean {
    return loan.state === "OUT" && loan.dueBackAt < now;
}

export function handOverError(state: LoanState): string | null {
    if (state === "OUT") return "That car is already out.";
    if (state !== "BOOKED") return "That loan is finished.";
    return null;
}

export function returnError(state: LoanState, outAt: Date, inAt: Date, odometerOut: number | null, odometerIn: number | null): string | null {
    if (state !== "OUT") return "That car is not out.";
    if (inAt < outAt) return "It cannot come back before it went out.";
    if (odometerOut !== null && odometerIn !== null && odometerIn < odometerOut) {
        return `The reading back, ${odometerIn}, is less than the ${odometerOut} it went out on.`;
    }
    return null;
}

/** How far it went, and how long it was gone — for the counter and for the record. */
export function loanSummary(loan: { outAt: Date; inAt: Date | null; odometerOut: number | null; odometerIn: number | null }, now: Date) {
    const end = loan.inAt ?? now;
    const hours = Math.max(0, Math.round(((end.getTime() - loan.outAt.getTime()) / 3_600_000) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const distance = loan.odometerOut !== null && loan.odometerIn !== null ? Math.max(0, loan.odometerIn - loan.odometerOut) : null;
    return { hours, days, distance, elapsed: elapsedLabel(hours) };
}

/** "0 hours out" reads like a fault on a car handed over a minute ago. */
export function elapsedLabel(hours: number): string {
    if (hours < 1) return "just gone out";
    if (hours < 24) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"} out`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} out`;
}

export const LOAN_STATE_LABELS: Record<LoanState, string> = {
    BOOKED: "Booked",
    OUT: "Out",
    RETURNED: "Back",
    CANCELLED: "Cancelled",
};
