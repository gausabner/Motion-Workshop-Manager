import type { DocumentType, TemplateKind } from "@prisma/client";

/**
 * What goes out with a document. Pure, so the template editor's preview and
 * the real send are rendered by the same code.
 *
 * The defaults live here rather than in seeded rows: a workshop that never
 * touches its templates still gets sensible wording, a new default reaches
 * every workshop that has not customised it, and there is nothing to backfill.
 */

export const MESSAGE_PURPOSES = ["QUOTE", "JOB_CARD", "INSPECTION", "INVOICE", "CREDIT", "RECEIPT", "REFUND", "STATEMENT", "PORTAL"] as const;
/** Reminders are messages too, with their own wording each — but about a date, not a document. */
export const REMINDER_PURPOSES = ["REMINDER_SERVICE", "REMINDER_LICENCE", "REMINDER_ROADWORTHY", "REMINDER_BOOKING", "REMINDER_QUOTE"] as const;
export type MessagePurpose = (typeof MESSAGE_PURPOSES)[number] | (typeof REMINDER_PURPOSES)[number];

export const PURPOSE_KIND: Record<MessagePurpose, TemplateKind> = {
    QUOTE: "MESSAGE_QUOTE",
    JOB_CARD: "MESSAGE_JOB_CARD",
    INSPECTION: "MESSAGE_INSPECTION",
    INVOICE: "MESSAGE_INVOICE",
    CREDIT: "MESSAGE_CREDIT",
    RECEIPT: "MESSAGE_RECEIPT",
    REFUND: "MESSAGE_REFUND",
    STATEMENT: "MESSAGE_STATEMENT",
    PORTAL: "MESSAGE_PORTAL",
    REMINDER_SERVICE: "MESSAGE_REMINDER_SERVICE",
    REMINDER_LICENCE: "MESSAGE_REMINDER_LICENCE",
    REMINDER_ROADWORTHY: "MESSAGE_REMINDER_ROADWORTHY",
    REMINDER_BOOKING: "MESSAGE_REMINDER_BOOKING",
    REMINDER_QUOTE: "MESSAGE_REMINDER_QUOTE",
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
    PORTAL: "Customer portal link",
    REMINDER_SERVICE: "Service due",
    REMINDER_LICENCE: "Licence disc expiring",
    REMINDER_ROADWORTHY: "Roadworthy expiring",
    REMINDER_BOOKING: "Booking coming up",
    REMINDER_QUOTE: "Quote follow-up",
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
    PORTAL: "Hi {{customer_first_name}}, here is your own page at {{workshop_name}}: your invoices, your vehicles' service dates, and anything waiting for your go-ahead, all in one place.\n{{link}}\nKeep this message — the link is your way back in.",
    // Vehicle reminders carry the online booking page when it is open; the "Book online" line drops out when it is not.
    REMINDER_SERVICE: "Hi {{customer_first_name}}, your {{vehicle}} ({{plate}}) is due for a service on {{due_date}}.\nReply here to book it in.\nOr book online: {{link}}\n— {{workshop_name}}",
    REMINDER_LICENCE: "Hi {{customer_first_name}}, the licence disc on your {{vehicle}} ({{plate}}) expires on {{due_date}}. If it needs a roadworthy or any work first, reply here and we will fit you in.\nOr book online: {{link}}\n— {{workshop_name}}",
    REMINDER_ROADWORTHY: "Hi {{customer_first_name}}, the roadworthy on your {{vehicle}} ({{plate}}) runs out on {{due_date}}. Reply here to book the test.\nOr book online: {{link}}\n— {{workshop_name}}",
    REMINDER_BOOKING: "Hi {{customer_first_name}}, a reminder that your {{vehicle}} ({{plate}}) is booked in with us on {{scheduled_at}}.\n{{link}}\nReply here if you need to change it. — {{workshop_name}}",
    REMINDER_QUOTE: "Hi {{customer_first_name}}, just checking in on quote {{document_number}} for your {{vehicle}} ({{plate}}): {{total}}.\n{{link}}\nReply here to go ahead, or with any questions. — {{workshop_name}}",
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
