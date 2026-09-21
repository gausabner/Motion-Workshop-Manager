import type { DocumentType } from "@prisma/client";

/**
 * What to ask when a document is processed (R4). The benchmark asks every
 * document for renewal dates; a quote or a credit note does not mean the car
 * came in, and asking for a mileage reading then invites a made-up number
 * that overwrites a real one. So the question depends on what is being
 * processed. Pure, so the rules are tested.
 */

export type PromptKind = "none" | "arrival" | "service";

export function promptFor(type: DocumentType, hasVehicle: boolean): PromptKind {
    if (!hasVehicle) return "none";
    switch (type) {
        // The car is in: the reading on the way in is worth having.
        case "BOOKING":
        case "JOB_CARD": return "arrival";
        // The work is done and billed: this is when the service record moves on.
        case "INVOICE":
        case "CASH_SALE": return "service";
        case "QUOTE":
        case "CREDIT": return "none";
    }
}

export const DEFAULT_SERVICE_KM = 10_000;
export const DEFAULT_SERVICE_MONTHS = 12;

export type PromptInput = {
    odometer: number | null;
    nextServiceKm: number | null;
    nextServiceDate: string | null;
    licenceExpiry: string | null;
    roadworthyExpiry: string | null;
    /** The reading is lower than the last one on purpose: a replaced clock, or a mistyped earlier reading. */
    odometerCorrected: boolean;
};

export type PromptContext = { kind: PromptKind; lastOdometer: number | null; postDate: string };

/** Field → message, empty when the answers can be saved. */
export function promptErrors(input: PromptInput, context: PromptContext): Record<string, string> {
    const errors: Record<string, string> = {};
    if (context.kind === "none") return errors;

    if (input.odometer !== null) {
        if (!Number.isInteger(input.odometer) || input.odometer < 0 || input.odometer > 3_000_000) errors.odometer = "That is not a reading an odometer shows.";
        else if (context.lastOdometer !== null && input.odometer < context.lastOdometer && !input.odometerCorrected) {
            errors.odometer = `Lower than the last reading of ${context.lastOdometer.toLocaleString("en-NA")} km. Tick the box if the clock was replaced or that reading was wrong.`;
        }
    }
    if (context.kind === "service") {
        if (input.odometer === null) errors.odometer = "The reading on the invoice is what the next service is worked out from.";
        if (input.nextServiceKm !== null && input.odometer !== null && input.nextServiceKm <= input.odometer) {
            errors.nextServiceKm = "The next service has to be further on than today's reading.";
        }
        if (input.nextServiceDate !== null && input.nextServiceDate <= context.postDate) errors.nextServiceDate = "The next service has to be after today.";
    }
    return errors;
}

/** What to offer when nothing has been entered: the usual interval on from today's reading. */
export function suggestNextService(odometer: number | null, postDate: string, interval = { km: DEFAULT_SERVICE_KM, months: DEFAULT_SERVICE_MONTHS }) {
    const [y, m, d] = postDate.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1 + interval.months, d));
    // 31 January plus a month is not 3 March: clamp to the month's last day.
    if (date.getUTCDate() !== d) date.setUTCDate(0);
    return {
        nextServiceKm: odometer !== null ? Math.round((odometer + interval.km) / 1000) * 1000 : null,
        nextServiceDate: date.toISOString().slice(0, 10),
    };
}
