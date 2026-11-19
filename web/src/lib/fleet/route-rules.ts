import type { Designation, JobSignDecision, JobSignRole, JobSignStage, VisitPurpose, WorkshopKind } from "@prisma/client";

/**
 * A council job's route, as pure functions: reception, the check bay, one or
 * more workshops, the check bay again, reception, and the driver collects.
 * The owner's job flow brief of 19 November 2026
 * (`docs/fleet-job-flow-plan.md` §4.3–4.4):
 *
 * - Moving a vehicle is a handover. The place it leaves sends it; the next
 *   accepts it. Nothing moves on until it has been accepted where it is.
 * - Nothing leaves reception until the job card is signed, nothing leaves the
 *   check bay for a workshop until it is assessed, and nothing reaches
 *   reception for collection until it passes the quality check.
 * - A failed quality check sends it back to the workshop that did the work.
 * - After assessment, the check bay or the foreman of the workshop it goes to
 *   sends it on, whichever acts first.
 */

export const PURPOSE_LABEL: Record<VisitPurpose, string> = {
    INTAKE: "Booked in",
    ASSESSMENT: "Assessment",
    WORK: "Work",
    QUALITY_CHECK: "Quality check",
    RELEASE: "Ready for collection",
};

export const ROLE_LABEL: Record<JobSignRole, string> = {
    RECEPTION: "Reception",
    DRIVER: "Driver",
    FOREMAN: "Foreman",
    FLEET_COORDINATOR: "Fleet Coordinator",
    MECHANIC: "Mechanic",
    INSPECTOR: "Check bay",
};

/** The place each purpose happens. */
export const PLACE_FOR: Record<VisitPurpose, WorkshopKind[]> = {
    INTAKE: ["RECEPTION"],
    ASSESSMENT: ["CHECK_BAY"],
    WORK: ["WORKSHOP", "BAY"],
    QUALITY_CHECK: ["CHECK_BAY"],
    RELEASE: ["RECEPTION"],
};

/** The signatures the job card needs when it is issued, unless the council's own card says otherwise. */
export const DEFAULT_ISSUE_ROLES: JobSignRole[] = ["RECEPTION", "DRIVER", "FOREMAN", "FLEET_COORDINATOR", "MECHANIC"];

/** Where a vehicle may go from a stay with this purpose. */
export function nextPurposes(current: VisitPurpose | null): VisitPurpose[] {
    switch (current) {
        case null: return ["INTAKE"];
        case "INTAKE": return ["ASSESSMENT"];
        case "ASSESSMENT": return ["WORK"];
        case "WORK": return ["WORK", "QUALITY_CHECK"];
        case "QUALITY_CHECK": return ["RELEASE", "WORK"];
        case "RELEASE": return [];
    }
}

export type Visit = { id: string; workshopId: string; purpose: VisitPurpose; received: boolean; left: boolean };

/** Where the vehicle is: the visit not yet left. */
export function currentVisit(visits: Visit[]): Visit | null {
    return visits.find((v) => !v.left) ?? null;
}

/** The workshop that did the work most recently — where a failed quality check sends it back. */
export function lastWorkshop(visits: Visit[]): string | null {
    for (let i = visits.length - 1; i >= 0; i--) if (visits[i].purpose === "WORK") return visits[i].workshopId;
    return null;
}

export type Signature = { stage: JobSignStage; role: JobSignRole; decision: JobSignDecision };

/** Whether the job card carries every signature the council's card asks for at issue. */
export function issueMissing(signatures: Signature[], required: JobSignRole[]): JobSignRole[] {
    const signed = new Set(signatures.filter((s) => s.stage === "ISSUE").map((s) => s.role));
    return required.filter((r) => !signed.has(r));
}

/** The latest quality check's outcome, or null if none has been signed since it last went for one. */
export function qualityOutcome(signatures: Signature[]): "PASSED" | "FAILED" | null {
    const checks = signatures.filter((s) => s.stage === "QUALITY_CHECK");
    const last = checks.at(-1);
    return last ? (last.decision === "PASSED" ? "PASSED" : last.decision === "FAILED" ? "FAILED" : null) : null;
}

/**
 * Why the vehicle cannot be sent on to `purpose` at a place of `kind`, in
 * words for the person at the screen, or null.
 */
export function moveError(input: {
    current: Visit | null;
    purpose: VisitPurpose;
    destination: { id: string; kind: WorkshopKind };
    issueMissing: JobSignRole[];
    assessed: boolean;
    quality: "PASSED" | "FAILED" | null;
    lastWorkshopId: string | null;
}): string | null {
    const { current, purpose, destination } = input;
    if (current && !current.received) return "It has not been accepted where it was sent yet. It moves on once it is.";
    if (!nextPurposes(current?.purpose ?? null).includes(purpose)) {
        return current ? `From ${PURPOSE_LABEL[current.purpose].toLowerCase()} it goes to ${nextPurposes(current.purpose).map((p) => PURPOSE_LABEL[p].toLowerCase()).join(" or ") || "nowhere: the driver collects it"}.` : "Book it in at reception first.";
    }
    if (!PLACE_FOR[purpose].includes(destination.kind)) return `${PURPOSE_LABEL[purpose]} happens at ${PLACE_FOR[purpose].map((k) => KIND_LABEL[k].toLowerCase()).join(" or ")}.`;
    if (current?.workshopId === destination.id && purpose !== "WORK") return "It is already there.";
    if (current?.purpose === "WORK" && purpose === "WORK" && current.workshopId === destination.id) return "It is already in that workshop.";
    if (purpose === "ASSESSMENT" && input.issueMissing.length) {
        return `The job card still needs signing by ${input.issueMissing.map((r) => ROLE_LABEL[r].toLowerCase()).join(", ")} before the vehicle leaves reception.`;
    }
    if (current?.purpose === "ASSESSMENT" && purpose === "WORK" && !input.assessed) return "The check bay has not signed the assessment yet.";
    if (current?.purpose === "QUALITY_CHECK") {
        if (purpose === "RELEASE" && input.quality !== "PASSED") return "It has not passed the quality check.";
        if (purpose === "WORK") {
            if (input.quality !== "FAILED") return "Only a failed quality check sends it back to a workshop.";
            if (input.lastWorkshopId && destination.id !== input.lastWorkshopId) return "A failed quality check sends it back to the workshop that did the work.";
        }
    }
    return null;
}

export const KIND_LABEL: Record<WorkshopKind, string> = {
    RECEPTION: "Reception",
    CHECK_BAY: "Check bay",
    WORKSHOP: "Workshop",
    BAY: "Bay",
};

// ───────────────────────── who may act ─────────────────────────

export type Person = { membershipId: string; designations: Designation[]; foremanOf: string[] };

/** Somebody who works at a place: its appointed foremen, and at reception anyone designated Reception. */
export function worksAt(person: Person, place: { id: string; kind: WorkshopKind }): boolean {
    if (person.foremanOf.includes(place.id)) return true;
    return place.kind === "RECEPTION" && person.designations.includes("RECEPTION");
}

/**
 * Who may send a vehicle on from where it is: somebody who works there — and,
 * from the check bay to a workshop, the foreman of the workshop it is going to.
 */
export function maySend(person: Person, from: { id: string; kind: WorkshopKind } | null, to: { id: string; kind: WorkshopKind }, purpose: VisitPurpose): boolean {
    if (!from) return purpose === "INTAKE" && worksAt(person, to);
    if (worksAt(person, from)) return true;
    return from.kind === "CHECK_BAY" && purpose === "WORK" && person.foremanOf.includes(to.id);
}

/** Who may accept it at the place it was sent: somebody who works there. */
export function mayAccept(person: Person, at: { id: string; kind: WorkshopKind }): boolean {
    return worksAt(person, at);
}

/**
 * Who may sign a box on the job card. A driver has no login; reception
 * records their name and pay number. The check bay signs assessments and
 * quality checks.
 */
export function maySign(person: Person, role: JobSignRole, checkBays: string[]): boolean {
    switch (role) {
        case "RECEPTION":
        case "DRIVER":
            return person.designations.includes("RECEPTION");
        case "FOREMAN":
            return person.designations.includes("FOREMAN") || person.foremanOf.length > 0;
        case "FLEET_COORDINATOR":
            return person.designations.includes("FLEET_COORDINATOR");
        case "MECHANIC":
            return person.designations.some((d) => d === "MECHANIC" || d === "ARTISAN" || d === "INTERN");
        case "INSPECTOR":
            return checkBays.some((id) => person.foremanOf.includes(id));
    }
}

/** The stages each role signs at. */
export const ROLES_AT: Record<JobSignStage, JobSignRole[]> = {
    ISSUE: ["RECEPTION", "DRIVER", "FOREMAN", "FLEET_COORDINATOR", "MECHANIC"],
    ASSESSMENT: ["INSPECTOR"],
    QUALITY_CHECK: ["INSPECTOR"],
    COLLECTION: ["DRIVER", "RECEPTION"],
};

/**
 * Why this signature cannot be given now, or null. At issue nobody signs two
 * boxes — a job card signed five times by two people is two checks, not five
 * — and each box is signed once. The check bay signs at the check bay; the
 * driver collects only a vehicle that is ready.
 */
export function signError(input: {
    stage: JobSignStage;
    role: JobSignRole;
    current: Visit | null;
    signatures: (Signature & { membershipId: string | null })[];
    signerId: string;
    required: JobSignRole[];
}): string | null {
    const { stage, role, current } = input;
    if (!ROLES_AT[stage].includes(role)) return `${ROLE_LABEL[role]} does not sign at this stage.`;
    if (stage === "ISSUE") {
        if (!input.required.includes(role)) return `Your council's job card does not ask for the ${ROLE_LABEL[role].toLowerCase()}'s signature.`;
        const issue = input.signatures.filter((s) => s.stage === "ISSUE");
        if (issue.some((s) => s.role === role)) return "That box is already signed.";
        if (role !== "DRIVER" && issue.some((s) => s.role !== "DRIVER" && s.membershipId === input.signerId)) return "You have already signed this job card. Another person signs this box.";
        if (current && current.purpose !== "INTAKE") return "The job card is signed at reception, before the vehicle leaves it.";
        return null;
    }
    if (stage === "ASSESSMENT" || stage === "QUALITY_CHECK") {
        const want: VisitPurpose = stage === "ASSESSMENT" ? "ASSESSMENT" : "QUALITY_CHECK";
        if (!current || current.purpose !== want || !current.received) return `The vehicle is not at the check bay for its ${PURPOSE_LABEL[want].toLowerCase()}.`;
        if (stage === "ASSESSMENT" && input.signatures.some((s) => s.stage === "ASSESSMENT")) return "The assessment is already signed.";
        return null;
    }
    // Collection.
    if (!current || current.purpose !== "RELEASE" || !current.received) return "It is not at reception ready for collection.";
    if (input.signatures.filter((s) => s.stage === "COLLECTION").some((s) => s.role === role)) return "That box is already signed.";
    return null;
}

/** Collected once both the driver and reception have signed. */
export function collected(signatures: Signature[]): boolean {
    const roles = new Set(signatures.filter((s) => s.stage === "COLLECTION").map((s) => s.role));
    return roles.has("DRIVER") && roles.has("RECEPTION");
}

/** Minutes between two moments, for time in a bay. Never negative. */
export function minutesBetween(from: Date, to: Date): number {
    return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}
