"use client";

import { useState, useTransition } from "react";
import { Copy, FileMinus, Ban, ArrowRight, MessageCircle, Printer, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertDocument, copyDocument, createCreditNote, markContacted, voidDocument } from "@/lib/documents/actions";
import { ProcessDialog } from "@/components/documents/ProcessDialog";
import { createPayment, createRefund } from "@/lib/payments/actions";
import { SendDialog } from "@/components/messaging/SendDialog";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { SplitDialog } from "@/components/documents/SplitDialog";
import { reworkDocumentAction } from "@/lib/documents/split-actions";
import { reworkError } from "@/lib/documents/split";
import type { DocumentRecord } from "@/lib/documents/queries";

type Props = {
    tenant: string;
    doc: DocumentRecord;
    currency: string;
    canProcess: boolean;
    canVoid: boolean;
    canTakePayment: boolean;
    canSend: boolean;
};

/**
 * Lifecycle buttons. They sit outside the editor's form because each posts to
 * its own server action, and forms cannot nest.
 */
export function DocumentToolbar({ tenant, doc, currency, canProcess, canVoid, canTakePayment, canSend }: Props) {
    const [voiding, setVoiding] = useState(false);
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

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
                <a href={`/${tenant}/dashboard/documents/${doc.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    <Printer className="w-4 h-4 mr-1" />Print
                </a>
            </Button>
            {canSend && doc.customer && doc.state !== "VOID" && (
                <SendDialog tenant={tenant} target={{ kind: "DOCUMENT", id: doc.id }} label={`${DOCUMENT_TYPE_LABELS[doc.type].toLowerCase()} ${doc.number ?? doc.jobNumber ?? ""}`.trim()} />
            )}
            {owing && canTakePayment && (
                <form action={createPayment.bind(null, tenant, { documentId: doc.id })}>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700"><Wallet className="w-4 h-4 mr-1" />Take payment</Button>
                </form>
            )}
            {refundable && canTakePayment && (
                <form action={createRefund.bind(null, tenant, { documentId: doc.id })}>
                    <Button type="submit" size="sm" variant="outline"><Undo2 className="w-4 h-4 mr-1" />Refund</Button>
                </form>
            )}
            {isDraft && canStartJob && (
                <form action={convertDocument.bind(null, tenant, doc.id, "JOB_CARD")}>
                    <Button type="submit" size="sm" variant="outline"><ArrowRight className="w-4 h-4 mr-1" />Start job</Button>
                </form>
            )}
            {isDraft && canInvoice && (
                <form action={convertDocument.bind(null, tenant, doc.id, "INVOICE")}>
                    <Button type="submit" size="sm" variant="outline"><ArrowRight className="w-4 h-4 mr-1" />Convert to invoice</Button>
                </form>
            )}
            {isDraft && canProcess && <ProcessDialog tenant={tenant} doc={doc} />}
            {isProcessed && (
                <form action={markContacted.bind(null, tenant, doc.id)}>
                    <Button type="submit" size="sm" variant="outline" title={doc.contactedAt ? "Mark as contacted again" : "Record that the customer was told"}>
                        <MessageCircle className="w-4 h-4 mr-1" />{doc.contactedAt ? "Contacted" : "Mark contacted"}
                    </Button>
                </form>
            )}
            <form action={copyDocument.bind(null, tenant, doc.id)}>
                <Button type="submit" size="sm" variant="outline"><Copy className="w-4 h-4 mr-1" />Copy</Button>
            </form>
            {isProcessed && (doc.type === "INVOICE" || doc.type === "CASH_SALE") && (
                <form action={createCreditNote.bind(null, tenant, doc.id)}>
                    <Button type="submit" size="sm" variant="outline"><FileMinus className="w-4 h-4 mr-1" />Credit note</Button>
                </form>
            )}
            {isDraft && doc.type !== "CREDIT" && doc.lines.length > 0 && (
                <SplitDialog
                    tenant={tenant} documentId={doc.id} currency={currency} total={Number(doc.total)}
                    lines={doc.lines.map((l) => ({ id: l.id, description: l.description, lineTotal: Number(l.lineTotal) }))}
                />
            )}

            {canRework && (reworking ? (
                <span className="flex items-center gap-2">
                    <input
                        value={reworkNote} onChange={(e) => setReworkNote(e.target.value)} autoFocus
                        placeholder="What came back?" className="h-8 w-56 rounded-md border border-slate-300 px-2 text-sm"
                    />
                    <Button
                        type="button" size="sm" variant="outline" disabled={!reworkNote.trim() || opening}
                        onClick={() => startRework(async () => {
                            const result = await reworkDocumentAction(tenant, doc.id, reworkNote);
                            if (result && !result.ok) setReworkProblem(result.message);
                        })}
                    >
                        {opening ? "Opening…" : "Open the rework"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setReworking(false)}>Cancel</Button>
                    {reworkProblem && <span className="text-sm text-red-600" role="alert">{reworkProblem}</span>}
                </span>
            ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setReworking(true)}><Undo2 className="mr-1 h-4 w-4" />Came back</Button>
            ))}

            {doc.state !== "VOID" && canVoid && (
                voiding ? (
                    <form action={voidDocument.bind(null, tenant, doc.id)} className="flex items-center gap-2">
                        <input name="voidReason" required autoFocus placeholder="Reason for voiding" className="h-8 w-56 rounded-sm border border-red-300 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500" />
                        <Button type="submit" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">Confirm void</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setVoiding(false)}>Cancel</Button>
                    </form>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className="text-slate-500 hover:text-red-700" onClick={() => setVoiding(true)}>
                        <Ban className="w-4 h-4 mr-1" />Void
                    </Button>
                )
            )}
        </div>
    );
}
