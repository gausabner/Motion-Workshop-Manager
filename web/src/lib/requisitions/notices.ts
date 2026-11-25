import "server-only";
import type { RequisitionStep, Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fullName, money } from "@/lib/format";
import { notify } from "@/lib/notifications/notify";
import { candidatesFor, eligible, FINAL_REQUIRED, stepOf, type ApprovalStep } from "@/lib/requisitions/rules";
import { signedThisRound, signingContext, type Actor } from "@/lib/requisitions/service";

/**
 * Telling people about a requisition, inside the transaction that moved it:
 * those whose signature it now waits for, the fleet coordinator of the
 * division that pays, and the person who raised it once it is decided.
 * Whoever acted is never told about their own act.
 */

export type RequisitionEvent = "SUBMITTED" | "DECIDED" | "ISSUED";

const SIGN_AS: Record<ApprovalStep | "FINAL_FOREMAN" | "FINAL_FLEET_COORDINATOR" | "FINAL_DIVISIONAL_HEAD", string> = {
    FOREMAN: "foreman",
    DIVISIONAL_HEAD: "divisional head",
    OVER_LIMIT: "approver above the value limit",
    FINAL_FOREMAN: "foreman",
    FINAL_FLEET_COORDINATOR: "fleet coordinator",
    FINAL_DIVISIONAL_HEAD: "divisional head",
};

export async function tellAboutRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, event: RequisitionEvent): Promise<void> {
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            number: true, kind: true, state: true, value: true, requestedById: true, workshopId: true, chargeVoteId: true,
            workshop: { select: { name: true } },
            chargeDocument: { select: { jobNumber: true } },
            chargeVote: { select: { code: true } },
            requestedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
    });
    if (!req) return;
    const number = req.number ?? "A requisition";
    const what = `${req.kind === "PURCHASE" ? "Purchase" : "Stores"} requisition${req.workshop ? ` from ${req.workshop.name}` : ""}${req.chargeDocument?.jobNumber ? ` for ${req.chargeDocument.jobNumber}` : req.chargeVote ? ` against vote ${req.chargeVote.code}` : ""}, ${money(req.value.toString(), tenant.currency)}`;
    const raisedBy = `Raised by ${fullName(req.requestedBy.user)}`;
    const href = `dashboard/requisitions/${id}`;
    const tell = (to: Iterable<string>, title: string, body: string) => notify(tx, tenant.id, to, { kind: "REQUISITION", title, body, href }, actor.membershipId);

    const step = stepOf(req.state);
    if (step && (event === "SUBMITTED" || event === "DECIDED")) {
        const { scope, authorities, units } = await signingContext(tx, req);
        const to = eligible(candidatesFor(step, scope, authorities, units), { requesterId: req.requestedById, signedThisRound: await signedThisRound(tx, id) });
        await tell(to.map((c) => c.membershipId), `${number} is waiting for your signature`, `${what}. Sign as ${SIGN_AS[step]}. ${raisedBy}.`);
        if (event === "SUBMITTED") {
            const payers = candidatesFor("PAYER", scope, authorities, units).map((c) => c.membershipId);
            await tell(payers, `${number} is charged to your division`, `${what}. You may approve it against the vote or witness it; it does not wait for you. ${raisedBy}.`);
        }
        return;
    }

    if (event === "DECIDED") {
        const last = await tx.requisitionSignoff.findFirst({ where: { requisitionId: id }, orderBy: { at: "desc" }, select: { name: true, comment: true } });
        const by = last ? ` by ${last.name}` : "";
        const said = last?.comment ? ` “${last.comment}”` : "";
        if (req.state === "APPROVED") await tell([req.requestedById], `${number} is approved`, `${what}. ${req.kind === "PURCHASE" ? "It can be ordered now." : "Stores can issue it now."}`);
        else if (req.state === "DRAFT") await tell([req.requestedById], `${number} was returned for changes`, `Returned${by}.${said} Change it and submit it again.`);
        else if (req.state === "REJECTED") await tell([req.requestedById], `${number} was rejected`, `Rejected${by}.${said}`);
        return;
    }

    if (event === "ISSUED" && req.state === "AWAITING_FINALISE") {
        const { scope, authorities, units } = await signingContext(tx, req);
        const done = new Set((await tx.requisitionSignoff.findMany({ where: { requisitionId: id, step: { in: FINAL_REQUIRED as RequisitionStep[] } }, select: { step: true } })).map((s) => s.step));
        for (const box of FINAL_REQUIRED) {
            if (box === "FINAL_FITTER" || done.has(box)) continue;
            const to = candidatesFor(box, scope, authorities, units).map((c) => c.membershipId);
            await tell(to, `${number} is ready to finalise`, `${what}. Everything has been issued. Sign as ${SIGN_AS[box]} to finalise it.`);
        }
    }
}
