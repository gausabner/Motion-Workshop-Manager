import type { DocumentType, TemplateKind } from "@prisma/client";

/**
 * What goes out with a document. Pure, so the template editor's preview and
 * the real send are rendered by the same code.
 *
 * The defaults live here rather than in seeded rows: a workshop that never
 * touches its templates still gets sensible wording, a new default reaches
 * every workshop that has not customised it, and there is nothing to backfill.
 */

export const MESSAGE_PURPOSES = ["QUOTE", "JOB_CARD", "INSPECTION", "INVOICE", "CREDIT", "RECEIPT", "REFUND", "STATEMENT"] as const;
export type MessagePurpose = (typeof MESSAGE_PURPOSES)[number];

export const PURPOSE_KIND: Record<MessagePurpose, TemplateKind> = {
    QUOTE: "MESSAGE_QUOTE",
    JOB_CARD: "MESSAGE_JOB_CARD",
    INSPECTION: "MESSAGE_INSPECTION",
    INVOICE: "MESSAGE_INVOICE",
    CREDIT: "MESSAGE_CREDIT",
    RECEIPT: "MESSAGE_RECEIPT",
    REFUND: "MESSAGE_REFUND",
    STATEMENT: "MESSAGE_STATEMENT",
};

export const PURPOSE_LABELS: Record<MessagePurpose, string> = {
    QUOTE: "Quote",
    JOB_CARD: "Job card or booking",
    INSPECTION: "Inspection to approve",
    INVOICE: "Invoice or cash sale",
    CREDIT: "Credit note",
    RECEIPT: "Receipt",
    REFUND: "Refund",
    STATEMENT: "Statement",
};

/**
 * Written for WhatsApp first: short, first name, the figure that matters, the
 * link on its own line so it previews. Lines whose fields are all empty drop
 * out, which is why "Amount due" sits on a line by itself.
 */
export const DEFAULT_MESSAGES: Record<MessagePurpose, string> = {
    QUOTE: "Hi {{customer_first_name}}, here is your quote {{document_number}} for the {{vehicle}} ({{plate}}): {{total}}.\n{{link}}\nReply here with any questions. — {{workshop_name}}",
    JOB_CARD: "Hi {{customer_first_name}}, your {{vehicle}} ({{plate}}) is booked in with us as job {{document_number}}.\n{{link}}\n— {{workshop_name}}",
    INSPECTION: "Hi {{customer_first_name}}, we have inspected your {{vehicle}} ({{plate}}). Some things need your go-ahead:\nUrgent: {{urgent_total}}\nSoon: {{soon_total}}\nSee the photos and tick what you want done:\n{{link}}\n— {{workshop_name}}",
    INVOICE: "Hi {{customer_first_name}}, your invoice {{document_number}} from {{workshop_name}} is ready: {{total}}.\nAmount due: {{amount_due}}\n{{link}}\nBanking details are on the invoice. Thank you!",
    CREDIT: "Hi {{customer_first_name}}, here is credit note {{document_number}} from {{workshop_name}} for {{total}}.\n{{link}}",
    RECEIPT: "Hi {{customer_first_name}}, thank you — we received {{total}}. Your receipt {{document_number}}:\n{{link}}\n— {{workshop_name}}",
    REFUND: "Hi {{customer_first_name}}, we have refunded you {{total}}. Your refund slip {{document_number}}:\n{{link}}\n— {{workshop_name}}",
    STATEMENT: "Hi {{customer_first_name}}, here is your statement from {{workshop_name}}.\nBalance due: {{account_balance}}\n{{link}}\nPlease quote your account name as the EFT reference.",
};

export function purposeForDocument(type: DocumentType): MessagePurpose {
    switch (type) {
        case "QUOTE": return "QUOTE";
        case "BOOKING":
        case "JOB_CARD": return "JOB_CARD";
        case "CREDIT": return "CREDIT";
        case "INVOICE":
        case "CASH_SALE": return "INVOICE";
    }
}

/**
 * The link is the point of the message. A workshop that edits it out of the
 * wording still sends the document — it just goes on the end.
 */
export function ensureLink(body: string): string {
    return /\{\{\s*link\s*\}\}/i.test(body) ? body : `${body.trimEnd()}\n{{link}}`;
}

/** Email only: WhatsApp has no subject line. */
export function emailSubject(title: string, number: string | null, workshop: string): string {
    return [title, number, `from ${workshop}`].filter(Boolean).join(" ");
}
