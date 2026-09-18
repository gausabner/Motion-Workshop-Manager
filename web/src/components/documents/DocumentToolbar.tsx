"use client";

import { useState } from "react";
import { CheckCircle2, Copy, FileMinus, Ban, ArrowRight, MessageCircle, Printer, Undo2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { convertDocument, copyDocument, createCreditNote, markContacted, processDocument, voidDocument } from "@/lib/documents/actions";
import { createPayment, createRefund } from "@/lib/payments/actions";
import { SendDialog } from "@/components/messaging/SendDialog";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import type { DocumentRecord } from "@/lib/documents/queries";

type Props = {
    tenant: string;
    doc: DocumentRecord;
    canProcess: boolean;
    canVoid: boolean;
    canTakePayment: boolean;
    canSend: boolean;
};

/**
 * Lifecycle buttons. They sit outside the editor's form because each posts to
 * its own server action, and forms cannot nest.
 */
export function DocumentToolbar({ tenant, doc, canProcess, canVoid, canTakePayment, canSend }: Props) {
    const [voiding, setVoiding] = useState(false);
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
            {isDraft && canProcess && (
                <form action={processDocument.bind(null, tenant, doc.id)}>
                    <Button type="submit" size="sm" className="bg-slate-800 hover:bg-slate-900"><CheckCircle2 className="w-4 h-4 mr-1" />Process</Button>
                </form>
            )}
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
