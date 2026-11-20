import "server-only";
import type { JobSignRole, JobSignStage, Tenant, VisitPurpose, WorkshopKind } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import { jobFlowSettings } from "@/lib/settings/schema";
import type { ActionState } from "@/lib/forms";
import { checkProgress, type CheckPurpose } from "@/lib/fleet/check-rules";
import {
    currentVisit,
    issueMissing,
    lastWorkshop,
    mayAccept,
    maySend,
    maySign,
    minutesBetween,
    moveError,
    nextPurposes,
    PLACE_FOR,
    qualityOutcome,
    ROLES_AT,
    signError,
    type Person,
} from "@/lib/fleet/route-rules";

/**
 * What the route panel and the on-site board show, and what the person
 * looking may do from where they stand. Plain values only — dates as ISO
 * strings — so they cross to client components unchanged.
 */

export type RouteView = {
    visits: {
        id: string; place: string; kind: WorkshopKind; purpose: VisitPurpose; note: string | null;
        sentAt: string; sentBy: string | null; receivedAt: string | null; receivedBy: string | null; leftAt: string | null; minutes: number | null;
    }[];
    signatures: { id: string; stage: JobSignStage; role: JobSignRole; decision: string; name: string; payNumber: string | null; comment: string | null; at: string }[];
    issueRoles: JobSignRole[];
    issueMissing: JobSignRole[];
    /** The signatures the stage it is at still waits for, so each shows as a row to be filled. */
    waiting: { stage: JobSignStage; role: JobSignRole }[];
    /** Who is looking, as their signature would read. */
    me: { name: string; payNumber: string | null };
    /** The driver who signed at issue, so collection need not type them again. */
    driver: { name: string; payNumber: string | null } | null;
    collected: boolean;
    /** What the person looking can do. */
    can: {
        bookIn: { id: string; name: string }[];
        accept: string | null;
        send: { purpose: VisitPurpose; places: { id: string; name: string }[] }[];
        blocked: string | null;
        sign: { stage: JobSignStage; role: JobSignRole }[];
    };
    /**
     * The check bay's check for the stay it is on, while it is unsigned:
     * whether it must be an inspection (a template is chosen), the inspection
     * if started, and where a failed quality check would send it back to.
     */
    check: {
        purpose: CheckPurpose;
        required: boolean;
        inspection: { id: string; number: string | null; total: number; left: number; red: number; amber: number; failed: string[] } | null;
        returnTo: { id: string; name: string } | null;
    } | null;
};

/** What a move answers with: the usual outcome, and the job's route as it now stands. */
export type MoveState = ActionState & { route?: RouteView };

export async function viewer(db: TenantDb, membershipId: string): Promise<Person> {
    const m = await db.membership.findFirst({
        where: { id: membershipId },
        select: { designations: true, authorities: { where: { kind: "FOREMAN" }, select: { workshopId: true } } },
    });
    return { membershipId, designations: m?.designations ?? [], foremanOf: (m?.authorities ?? []).map((a) => a.workshopId).filter((x): x is string => !!x) };
}

export async function routeView(db: TenantDb, tenant: Tenant, documentId: string, membershipId: string, now = new Date()): Promise<RouteView> {
    const [rows, signoffs, places, person, me] = await Promise.all([
        db.jobVisit.findMany({
            where: { documentId },
            orderBy: { sentAt: "asc" },
            select: {
                id: true, workshopId: true, purpose: true, note: true, sentAt: true, receivedAt: true, leftAt: true,
                workshop: { select: { name: true, kind: true } },
                sentBy: { select: { user: { select: { firstName: true, lastName: true } } } },
                receivedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            },
        }),
        db.jobSignoff.findMany({ where: { documentId }, orderBy: { at: "asc" }, select: { id: true, stage: true, role: true, decision: true, membershipId: true, name: true, payNumber: true, comment: true, at: true } }),
        db.workshop.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
        viewer(db, membershipId),
        db.membership.findFirst({ where: { id: membershipId }, select: { payNumber: true, user: { select: { firstName: true, lastName: true } } } }),
    ]);
    const visits = rows.map((r) => ({ id: r.id, workshopId: r.workshopId, purpose: r.purpose, received: !!r.receivedAt, left: !!r.leftAt }));
    const current = currentVisit(visits);
    const here = current ? rows.find((r) => r.id === current.id)! : null;
    const required = jobFlowSettings(tenant.settings).issueRoles;
    const missing = issueMissing(signoffs, required);
    const sinceArrival = here?.receivedAt ? signoffs.filter((s) => s.at >= here.receivedAt!) : [];
    const gate = {
        issueMissing: missing,
        assessed: signoffs.some((s) => s.stage === "ASSESSMENT"),
        quality: qualityOutcome(sinceArrival),
        lastWorkshopId: lastWorkshop(visits),
    };
    const from = here ? { id: here.workshopId, kind: here.workshop.kind } : null;
    const collectedNow = rows.length > 0 && !current;

    // Where the person looking can send it, and — if the route allows a move but a gate is shut — why not.
    const send: RouteView["can"]["send"] = [];
    let blocked: string | null = null;
    if (!collectedNow && (!current || current.received)) {
        for (const purpose of nextPurposes(current?.purpose ?? null)) {
            if (purpose === "INTAKE") continue;
            const ok = places.filter((p) => PLACE_FOR[purpose].includes(p.kind) && maySend(person, from, p, purpose) && moveError({ current, purpose, destination: p, ...gate }) === null);
            if (ok.length) send.push({ purpose, places: ok.map((p) => ({ id: p.id, name: p.name })) });
            else if (!blocked) {
                const candidate = places.find((p) => PLACE_FOR[purpose].includes(p.kind) && maySend(person, from, p, purpose));
                if (candidate) blocked = moveError({ current, purpose, destination: candidate, ...gate });
            }
        }
    }

    const checkBays = places.filter((p) => p.kind === "CHECK_BAY").map((p) => p.id);
    const sign: RouteView["can"]["sign"] = [];
    for (const stage of Object.keys(ROLES_AT) as JobSignStage[]) {
        for (const role of ROLES_AT[stage]) {
            if (maySign(person, role, checkBays) && signError({ stage, role, current, signatures: signoffs, signerId: membershipId, required }) === null) sign.push({ stage, role });
        }
    }

    // What the stage the vehicle is at still waits for.
    const waiting: RouteView["waiting"] = missing.map((role) => ({ stage: "ISSUE" as const, role }));
    if (here?.receivedAt && here.workshop.kind === "CHECK_BAY" && (here.purpose === "ASSESSMENT" || here.purpose === "QUALITY_CHECK") && !sinceArrival.some((s) => s.stage === here.purpose)) {
        waiting.push({ stage: here.purpose, role: "INSPECTOR" });
    }
    if (here?.receivedAt && here.purpose === "RELEASE") {
        for (const role of ["DRIVER", "RECEPTION"] as const) if (!sinceArrival.some((s) => s.stage === "COLLECTION" && s.role === role)) waiting.push({ stage: "COLLECTION", role });
    }
    const issueDriver = signoffs.find((s) => s.stage === "ISSUE" && s.role === "DRIVER");

    // The check bay's check for this stay, if it is there for one and has not signed it yet.
    let check: RouteView["check"] = null;
    if (here?.receivedAt && here.workshop.kind === "CHECK_BAY" && (here.purpose === "ASSESSMENT" || here.purpose === "QUALITY_CHECK")) {
        const purpose: CheckPurpose = here.purpose;
        if (!sinceArrival.some((s) => s.stage === purpose)) {
            const settings = jobFlowSettings(tenant.settings);
            const inspection = await db.inspection.findFirst({
                where: { visitId: here.id },
                select: { id: true, number: true, items: { orderBy: { ordering: "asc" }, select: { description: true, urgent: true, soon: true, checked: true, comment: true } } },
            });
            const back = lastWorkshop(visits);
            check = {
                purpose,
                required: !!(purpose === "ASSESSMENT" ? settings.assessmentTemplateId : settings.qualityTemplateId),
                inspection: inspection
                    ? { id: inspection.id, number: inspection.number, ...checkProgress(inspection.items), failed: inspection.items.filter((i) => i.urgent).map((i) => i.description) }
                    : null,
                returnTo: back ? (places.find((p) => p.id === back) ?? null) : null,
            };
        }
    }

    const name = (m: { user: { firstName: string; lastName: string | null } } | null) => (m ? fullName(m.user) : null);
    return {
        visits: rows.map((r) => ({
            id: r.id, place: r.workshop.name, kind: r.workshop.kind, purpose: r.purpose, note: r.note,
            sentAt: r.sentAt.toISOString(), sentBy: name(r.sentBy), receivedAt: r.receivedAt?.toISOString() ?? null, receivedBy: name(r.receivedBy),
            leftAt: r.leftAt?.toISOString() ?? null, minutes: r.receivedAt ? minutesBetween(r.receivedAt, r.leftAt ?? now) : null,
        })),
        signatures: signoffs.map((s) => ({ id: s.id, stage: s.stage, role: s.role, decision: s.decision, name: s.name, payNumber: s.payNumber, comment: s.comment, at: s.at.toISOString() })),
        issueRoles: required,
        issueMissing: missing,
        waiting,
        me: { name: me ? fullName(me.user) : "", payNumber: me?.payNumber ?? null },
        driver: issueDriver ? { name: issueDriver.name, payNumber: issueDriver.payNumber } : null,
        collected: collectedNow,
        can: {
            bookIn: rows.length === 0 ? places.filter((p) => p.kind === "RECEPTION" && maySend(person, null, p, "INTAKE")).map((p) => ({ id: p.id, name: p.name })) : [],
            accept: here && !here.receivedAt && mayAccept(person, { id: here.workshopId, kind: here.workshop.kind }) ? here.id : null,
            send,
            blocked,
            sign,
        },
        check: check && check.returnTo ? { ...check, returnTo: { id: check.returnTo.id, name: check.returnTo.name } } : check,
    };
}

/** Every vehicle on site: where it is, since when, and whether it is still on its way there. */
export async function onSite(db: TenantDb, now = new Date()) {
    const open = await db.jobVisit.findMany({
        where: { leftAt: null },
        orderBy: { sentAt: "asc" },
        select: {
            id: true, purpose: true, sentAt: true, receivedAt: true, workshopId: true,
            workshop: { select: { name: true, kind: true } },
            inspections: { select: { id: true, items: { select: { description: true, urgent: true, soon: true, checked: true, comment: true } } } },
            document: {
                select: {
                    id: true, jobNumber: true, jobStatus: true,
                    vehicle: { select: { plate: true, fleetCode: true, make: true, model: true } },
                    customer: { select: { firstName: true, lastName: true } },
                },
            },
        },
    });
    return open.map((v) => ({
        visitId: v.id,
        workshopId: v.workshopId,
        place: v.workshop.name,
        kind: v.workshop.kind,
        purpose: v.purpose,
        arriving: !v.receivedAt,
        minutes: minutesBetween(v.receivedAt ?? v.sentAt, now),
        // The check bay's inspection for this stay, and how far through it is.
        check: v.inspections[0] ? { id: v.inspections[0].id, ...checkProgress(v.inspections[0].items) } : null,
        documentId: v.document.id,
        jobNumber: v.document.jobNumber,
        jobStatus: v.document.jobStatus,
        plate: v.document.vehicle?.plate ?? null,
        fleetCode: v.document.vehicle?.fleetCode ?? null,
        vehicle: [v.document.vehicle?.make, v.document.vehicle?.model].filter(Boolean).join(" ") || null,
        owner: v.document.customer ? fullName(v.document.customer) : null,
    }));
}
