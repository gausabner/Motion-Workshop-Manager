/**
 * How MOTION's own audit trail reads to a person: "Gaus Abner approved
 * TransTek". Shared by the overview and each workshop's page so one action is
 * never described two ways.
 */

const ACTION_WORDS: Record<string, (name: string) => string> = {
    ACTIVATED: (n) => `approved ${n}`,
    CANCELLED: (n) => `cancelled ${n}`,
    SUSPENDED: (n) => `suspended ${n}`,
    REACTIVATED: (n) => `switched ${n} back on`,
    RENEWED: (n) => `recorded a renewal from ${n}`,
    PAST_DUE: (n) => `made ${n} read-only — grace period over`,
    BILLING_SET: (n) => `set up billing for ${n}`,
    PAID_UNTIL_CHANGED: (n) => `changed ${n}'s paid-up-to date`,
    INVOICE_SENT: (n) => `sent ${n} its tax invoice again`,
    INVOICE_ISSUED: (n) => `issued a tax invoice to ${n}`,
    PAYMENT_RECORDED: (n) => `recorded an earlier payment from ${n}`,
    PAYMENT_REVERSED: (n) => `reversed a payment from ${n} and issued a credit note`,
    CREDIT_NOTE_SENT: (n) => `sent ${n} its credit note again`,
    PLAN_CHANGED: (n) => `changed ${n}'s plan`,
};

export function actorName(actor: { firstName: string; lastName: string } | null): string {
    return actor ? `${actor.firstName} ${actor.lastName}` : "MOTION (automatic)";
}

export function describeAction(action: string, workshopName: string | null | undefined): string {
    const name = workshopName ?? "a workshop since removed";
    return (ACTION_WORDS[action] ?? ((n: string) => `${action.toLowerCase().replace(/_/g, " ")} ${n}`))(name);
}
