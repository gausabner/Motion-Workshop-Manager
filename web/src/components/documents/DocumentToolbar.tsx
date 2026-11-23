"use client";

import { useState, useTransition } from "react";
import { Copy, FileMinus, Ban, ArrowRight, MessageCircle, Printer, Trash2, Undo2, Wallet } from "lucide-react";
import { MoreMenu } from "@/components/ui/more-menu";
import { Button } from "@/components/ui/button";
import { convertDocument, copyDocument, createCreditNote, deleteDocumentAction, markContacted, voidDocument } from "@/lib/documents/actions";
import { ProcessDialog } from "@/components/documents/ProcessDialog";
import { createPayment, createRefund } from "@/lib/payments/actions";
import { SendDialog } from "@/components/messaging/SendDialog";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { SplitDialog } from "@/components/documents/SplitDialog";
import { reworkDocumentAction } from "@/lib/documents/split-actions";
import { reworkError } from "@/lib/documents/split";
import type { DocumentRecord } from "@/lib/documents/queries";
import { useUnsaved } from "@/lib/documents/unsaved";
import { TERM } from "@/lib/copy/terms";

type Props = {
    tenant: string;
    doc: DocumentRecord;
    currency: string;
    canProcess: boolean;
    canVoid: boolean;
    canTakePayment: boolean;
    canSend: boolean;
    /**
     * A council job on its route. The route and its signatures are the work
     * there; invoicing and processing are the exception, so they wait under
     * More rather than leading the card.
     */
    fleet?: boolean;
};

/**
 * Lifecycle buttons. They sit outside the editor's form because each posts to
 * its own server action, and forms cannot nest.
 */
export function DocumentToolbar({ tenant, doc, currency, canProcess, canVoid, canTakePayment, canSend, fleet = false }: Props) {
    const [voiding, setVoiding] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [reworking, setReworking] = useState(false);
    const [reworkNote, setReworkNote] = useState("");
    const [reworkProblem, setReworkProblem] = useState<string>();
    const [opening, startRework] = useTransition();
    const canRework = reworkError(doc.state, doc.type) === null;
    const isDraft = doc.state === "DRAFT";
    const isProcessed = doc.state === "PROCESSED";
    const canInvoice = doc.type === "JOB_CARD" || doc.type === "QUOTE";
    const canStartJob = doc.type === "BOOKING" || doc.type === "QUOTE";
    // Only an invoice with money still on it, and only for someone with an account to put it against.
    const owing = isProcessed && (doc.type === "INVOICE" || doc.type === "CASH_SALE") && doc.amountDue > 0 && !!doc.customer;
    // A credit note that has not been used up can be handed back in cash or by EFT.
    const refundable = isProcessed && doc.type === "CREDIT" && doc.amountDue < 0 && !!doc.customer;
    // These act on the saved record, so they wait while the editor holds changes; its status line says why.
    const unsaved = useUnsaved(doc.id);

    // Everyday actions stay in sight; the rest wait under More, as SAP keeps a
    // page's rarer actions. Process lives in the footer bar with Save, except on
    // a council route, where invoicing and processing are the exception.
    const ghost = "w-full justify-start";
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
                <a href={`/${tenant}/dashboard/documents/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Printer className="w-4 h-4 mr-1" aria-hidden="true" />Print<span className="sr-only"> (opens in a new tab)</span>
                </a>
            </Button>
            {canSend && doc.customer && doc.state !== "VOID" && (
                <SendDialog tenant={tenant} target={{ kind: "DOCUMENT", id: doc.id }} label={`${DOCUMENT_TYPE_LABELS[doc.type].toLowerCase()} ${doc.number ?? doc.jobNumber ?? ""}`.trim()} disabled={unsaved} />
            )}
            {owing && canTakePayment && (
                <form action={createPayment.bind(null, tenant, { documentId: doc.id })}>
                    <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800"><Wallet className="w-4 h-4 mr-1" aria-hidden="true" />Take payment</Button>
                </form>
            )}
            {refundable && canTakePayment && (
                <form action={createRefund.bind(null, tenant, { documentId: doc.id })}>
                    <Button type="submit" size="sm" variant="outline"><Undo2 className="w-4 h-4 mr-1" aria-hidden="true" />Refund</Button>
                </form>
            )}
            {isDraft && canStartJob && (
                <form action={convertDocument.bind(null, tenant, doc.id, "JOB_CARD")}>
                    <Button type="submit" size="sm" variant="outline" disabled={unsaved}><ArrowRight className="w-4 h-4 mr-1" aria-hidden="true" />Start job</Button>
                </form>
            )}
            {!fleet && isDraft && canInvoice && (
                <form action={convertDocument.bind(null, tenant, doc.id, "INVOICE")}>
                    <Button type="submit" size="sm" variant="outline" disabled={unsaved}><ArrowRight className="w-4 h-4 mr-1" aria-hidden="true" />Convert to invoice</Button>
                </form>
            )}

            <MoreMenu>
                {fleet && isDraft && canInvoice && (
                    <form action={convertDocument.bind(null, tenant, doc.id, "INVOICE")}>
                        <Button type="submit" size="sm" variant="ghost" className={ghost} disabled={unsaved}><ArrowRight className="w-4 h-4 mr-1" aria-hidden="true" />Convert to invoice</Button>
                    </form>
                )}
                {fleet && isDraft && canProcess && <ProcessDialog tenant={tenant} doc={doc} disabled={unsaved} inMenu />}
                {isProcessed && (
                    <form action={markContacted.bind(null, tenant, doc.id)}>
                        <Button type="submit" size="sm" variant="ghost" className={ghost} title={doc.contactedAt ? "Record that it was sent again" : "Record that the document was sent to the customer outside MOTION"}>
                            <MessageCircle className="w-4 h-4 mr-1" aria-hidden="true" />{doc.contactedAt ? "Sent" : "Mark as sent"}
                        </Button>
                    </form>
                )}
                <form action={copyDocument.bind(null, tenant, doc.id)}>
                    <Button type="submit" size="sm" variant="ghost" className={ghost} disabled={unsaved}><Copy className="w-4 h-4 mr-1" aria-hidden="true" />Copy</Button>
                </form>
                {isProcessed && (doc.type === "INVOICE" || doc.type === "CASH_SALE") && (
                    <form action={createCreditNote.bind(null, tenant, doc.id)}>
                        <Button type="submit" size="sm" variant="ghost" className={ghost}><FileMinus className="w-4 h-4 mr-1" aria-hidden="true" />Credit note</Button>
                    </form>
                )}
                {isDraft && doc.type !== "CREDIT" && doc.lines.length > 0 && (
                    <SplitDialog
                        tenant={tenant} documentId={doc.id} currency={currency} total={Number(doc.total)}
                        lines={doc.lines.map((l) => ({ id: l.id, description: l.description, lineTotal: Number(l.lineTotal) }))}
                        disabled={unsaved}
                        inMenu
                    />
                )}
                {canRework && (reworking ? (
                    <span className="flex flex-wrap items-center gap-2 p-1">
                        <input
                            value={reworkNote} onChange={(e) => setReworkNote(e.target.value)} autoFocus
                            aria-label="Reason for the rework" placeholder="Reason for the rework" className="h-8 w-56 rounded-sm border border-[var(--motion-field-edge)] px-2 text-sm"
                        />
                        <Button
                            type="button" size="sm" variant="outline" disabled={!reworkNote.trim() || opening}
                            onClick={() => startRework(async () => {
                                const result = await reworkDocumentAction(tenant, doc.id, reworkNote);
                                if (result && !result.ok) setReworkProblem(result.message);
                            })}
                        >
                            {opening ? "Creating…" : "Create rework job card"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setReworking(false)}>Cancel</Button>
                        {reworkProblem && <span className="text-sm text-red-700" role="alert">{reworkProblem}</span>}
                    </span>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className={ghost} onClick={() => setReworking(true)}><Undo2 className="mr-1 h-4 w-4" aria-hidden="true" />{TERM.rework}</Button>
                ))}
                {doc.state !== "VOID" && canVoid && (
                    voiding ? (
                        <form action={voidDocument.bind(null, tenant, doc.id)} className="flex flex-wrap items-center gap-2 p-1">
                            <input name="voidReason" required autoFocus aria-label="Reason for voiding" placeholder="Reason for voiding" className="h-8 w-56 rounded-sm border border-red-700 px-2 text-sm" />
                            <Button type="submit" size="sm" variant="outline" className="border-red-700 text-red-700 hover:bg-slate-50">Confirm void</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setVoiding(false)}>Cancel</Button>
                        </form>
                    ) : (
                        <Button type="button" size="sm" variant="ghost" className={`${ghost} text-slate-700 hover:text-red-700`} onClick={() => setVoiding(true)}>
                            <Ban className="w-4 h-4 mr-1" aria-hidden="true" />Void
                        </Button>
                    )
                )}
                {/* Deleting is only ever for a document that should not exist — a
                    second job card from a double-tapped Convert, a draft nobody
                    meant to start. Anything real is voided, which keeps it. The
                    reason is required because it is what the audit entry is worth
                    reading for a year later. */}
                {(doc.state === "VOID" || doc.state === "DRAFT") && canVoid && (
                    deleting ? (
                        <form action={deleteDocumentAction.bind(null, tenant, doc.id)} className="flex flex-wrap items-center gap-2 p-1">
                            <input
                                name="reason" required autoFocus minLength={3}
                                aria-label="Why it is being deleted"
                                placeholder="Why — e.g. duplicate of JC-1043"
                                className="h-8 w-64 rounded-sm border border-red-700 px-2 text-sm"
                            />
                            <Button type="submit" size="sm" variant="outline" className="border-red-700 text-red-700 hover:bg-slate-50">Delete for good</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(false)}>Cancel</Button>
                        </form>
                    ) : (
                        <Button type="button" size="sm" variant="ghost" className={`${ghost} text-slate-700 hover:text-red-700`} onClick={() => setDeleting(true)}>
                            <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />Delete
                        </Button>
                    )
                )}
            </MoreMenu>
        </div>
    );
}
