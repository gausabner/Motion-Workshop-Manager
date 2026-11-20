/**
 * What an audit event is called, in the workshop's own words.
 *
 * This lived inside the document history panel, which was fine while one
 * document at a time was the only place a trail could be read. A transaction
 * log for a whole period reads the same events, and two lists that name the
 * same action differently is exactly the discrepancy an auditor stops on — so
 * there is one table and both read from it.
 */

const SAID: Record<string, string> = {
    CREATED: "Created",
    UPDATED: "Edited",
    PROCESSED: "Processed",
    VOIDED: "Voided",
    DELETED: "Deleted",
    ARCHIVED: "Archived",
    UNARCHIVED: "Restored",
    SENT: "Sent to the customer",
    STATUS_CHANGED: "Job status changed",
    RESCHEDULED: "Moved in the diary",
    APPROVED: "Approved by the customer",
    DECLINED: "Declined by the customer",
    SPLIT: "Split",
    CONVERTED: "Converted",
    EXPORTED: "Exported",
    // A council job's route, recorded against the job as "JobRoute" and read into its history.
    ROUTE_BOOKED_IN: "Booked in",
    ROUTE_SENT: "Sent on",
    ROUTE_ACCEPTED: "Accepted",
    ROUTE_SIGNED: "Signed",
    ROUTE_COLLECTED: "Collected",
};

const STAGE_WORDS: Record<string, string> = { ISSUE: "At issue", ASSESSMENT: "Assessment", QUALITY_CHECK: "Quality check", COLLECTION: "Collection" };
const ROLE_WORDS: Record<string, string> = { RECEPTION: "reception", DRIVER: "the driver", FOREMAN: "foreman", FLEET_COORDINATOR: "fleet coordinator", MECHANIC: "mechanic", INSPECTOR: "the check bay" };
const PURPOSE_WORDS: Record<string, string> = { ASSESSMENT: "for assessment", WORK: "for work", QUALITY_CHECK: "for its quality check", RELEASE: "for collection" };

export function actionWords(action: string): string {
    return SAID[action] ?? action.toLowerCase().replace(/_/g, " ");
}

/**
 * A change worth spelling out, rather than a JSON blob.
 *
 * Only the shapes actually written are handled; anything else is left off
 * rather than printed raw, because a line of braces in front of somebody
 * settling an argument is worse than no line at all.
 *
 * The one exception is a deletion. A log that records the act and not the
 * content cannot settle anything, so a deletion prints what was on the
 * document — its number, its customer and its total — from the snapshot taken
 * before the row went.
 */
export function actionDetail(action: string, diff: unknown): string | null {
    if (!diff || typeof diff !== "object") return null;
    const d = diff as Record<string, unknown>;

    if (action === "DELETED") {
        const snap = (d.snapshot ?? d) as Record<string, unknown>;
        const parts = [
            snap.number ?? snap.jobNumber,
            snap.customer && typeof snap.customer === "object"
                ? `${(snap.customer as Record<string, string>).firstName ?? ""} ${(snap.customer as Record<string, string>).lastName ?? ""}`.trim()
                : null,
            snap.total !== undefined && snap.total !== null ? `total ${String(snap.total)}` : null,
            typeof d.reason === "string" ? d.reason : typeof snap.deletedBecause === "string" ? snap.deletedBecause : null,
        ].filter((p): p is string => typeof p === "string" && p.length > 0);
        return parts.length > 0 ? parts.join(" · ") : null;
    }
    if (action === "RESCHEDULED" && typeof d.from === "string" && typeof d.to === "string") {
        return `${String(d.from).replace("T", " ")} → ${String(d.to).replace("T", " ")}`;
    }
    if (action === "STATUS_CHANGED" && (d.from || d.to)) {
        return `${String(d.from ?? "—").toLowerCase().replace(/_/g, " ")} → ${String(d.to ?? "—").toLowerCase().replace(/_/g, " ")}`;
    }
    if (action === "EXPORTED") {
        return [d.report, d.format, d.rows !== undefined ? `${String(d.rows)} rows` : null].filter(Boolean).join(" · ") || null;
    }
    if ((action === "ROUTE_BOOKED_IN" || action === "ROUTE_ACCEPTED") && typeof d.at === "string") return `at ${d.at}`;
    if (action === "ROUTE_SENT" && typeof d.to === "string") return `to ${d.to}${typeof d.purpose === "string" && PURPOSE_WORDS[d.purpose] ? ` ${PURPOSE_WORDS[d.purpose]}` : ""}`;
    if ((action === "ROUTE_SIGNED" || action === "ROUTE_COLLECTED") && typeof d.stage === "string") {
        // "Quality check, as the check bay: passed"; "Collection, for the driver Moses Shilongo".
        const who = typeof d.recordedFor === "string" ? `, for the driver ${d.recordedFor}` : typeof d.role === "string" ? `, as ${ROLE_WORDS[d.role] ?? d.role.toLowerCase()}` : "";
        const outcome = d.decision === "PASSED" ? ": passed" : d.decision === "FAILED" ? ": failed" : "";
        return `${STAGE_WORDS[d.stage] ?? ""}${who}${outcome}`;
    }
    if (action === "CREATED" && typeof d.type === "string") return String(d.type).toLowerCase().replace(/_/g, " ");
    if (typeof d.reason === "string") return d.reason;
    return null;
}
