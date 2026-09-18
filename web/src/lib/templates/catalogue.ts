import type { TemplateKind } from "@prisma/client";
import { DEFAULT_MESSAGES, PURPOSE_KIND, PURPOSE_LABELS, MESSAGE_PURPOSES } from "@/lib/messaging/templates";

/**
 * Every template a workshop can reword, with the wording it gets if it never
 * does. One rule for all of them: a row in the database overrides the default
 * here, and deleting the row puts the default back.
 */

export type EditableTemplate = {
    kind: TemplateKind;
    label: string;
    group: "Sent with documents" | "Printed on documents";
    description: string;
    defaultBody: string;
    /** A footer may be blank on purpose; a message may not. */
    allowEmpty: boolean;
};

export const DEFAULT_FOOTERS = {
    INVOICE_FOOTER: "Thank you for your business. Payment is due on receipt unless terms are agreed.\nBanking details: {{bank_details}}\nVAT No. {{vat_number}}",
    QUOTE_FOOTER: "This quote is valid for 14 days. Prices include VAT unless stated. Parts subject to availability.",
    JOB_CARD_FOOTER: "Vehicle left at owner's risk. Additional work will only be carried out with the customer's approval.",
    STATEMENT_FOOTER: "Please quote your account name as the EFT reference. Queries: {{workshop_phone}}.",
} as const satisfies Partial<Record<TemplateKind, string>>;

const MESSAGE_DESCRIPTIONS: Record<(typeof MESSAGE_PURPOSES)[number], string> = {
    QUOTE: "Goes out with a quote.",
    JOB_CARD: "Goes out with a booking or job card — usually as the booking confirmation.",
    INVOICE: "Goes out with an invoice or cash sale. The amount-due line disappears once it is paid.",
    CREDIT: "Goes out with a credit note.",
    RECEIPT: "Goes out with a receipt after payment is taken.",
    REFUND: "Goes out with a refund slip.",
    STATEMENT: "Goes out with a customer statement.",
};

export const EDITABLE_TEMPLATES: EditableTemplate[] = [
    ...MESSAGE_PURPOSES.map((purpose) => ({
        kind: PURPOSE_KIND[purpose],
        label: PURPOSE_LABELS[purpose],
        group: "Sent with documents" as const,
        description: MESSAGE_DESCRIPTIONS[purpose],
        defaultBody: DEFAULT_MESSAGES[purpose],
        allowEmpty: false,
    })),
    { kind: "INVOICE_FOOTER", label: "Invoice, cash sale, credit note and receipt", group: "Printed on documents", description: "Printed under the totals as the terms.", defaultBody: DEFAULT_FOOTERS.INVOICE_FOOTER, allowEmpty: true },
    { kind: "QUOTE_FOOTER", label: "Quote", group: "Printed on documents", description: "Printed under the totals on a quote.", defaultBody: DEFAULT_FOOTERS.QUOTE_FOOTER, allowEmpty: true },
    { kind: "JOB_CARD_FOOTER", label: "Booking and job card", group: "Printed on documents", description: "Printed under the totals on a job card.", defaultBody: DEFAULT_FOOTERS.JOB_CARD_FOOTER, allowEmpty: true },
    { kind: "STATEMENT_FOOTER", label: "Statement", group: "Printed on documents", description: "Printed under the ageing on a statement.", defaultBody: DEFAULT_FOOTERS.STATEMENT_FOOTER, allowEmpty: true },
];

export function editableTemplate(kind: string): EditableTemplate | undefined {
    return EDITABLE_TEMPLATES.find((t) => t.kind === kind);
}

export function defaultBodyFor(kind: TemplateKind): string {
    return editableTemplate(kind)?.defaultBody ?? "";
}
