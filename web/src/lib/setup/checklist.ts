/**
 * What a new workshop still has to do before MOTION runs its day, worked out
 * from its own data — never a wizard, never a tick-box someone can tick
 * without doing the thing.
 *
 * The order is the order things break: a document with no address or VAT
 * number is the first thing a customer sees, a diary with no mechanic cannot
 * take a booking. Workshop Software sends a new account straight to an empty
 * dashboard and lets it find these the hard way.
 */

export type SetupFacts = {
    hasAddress: boolean;
    hasContact: boolean;
    taxReviewed: boolean;
    hasVatNumber: boolean;
    hasLogo: boolean;
    hasBankDetails: boolean;
    hoursSet: boolean;
    mechanics: number;
    customers: number;
    jobs: number;
    onlineBooking: boolean;
};

export type SetupStep = { key: string; title: string; why: string; href: string; done: boolean; optional?: boolean };

export function setupSteps(f: SetupFacts, base: string): SetupStep[] {
    const settings = `${base}/dashboard/settings`;
    return [
        {
            key: "company", title: "Add your address and contact details", href: `${settings}/company`, done: f.hasAddress && f.hasContact,
            why: "Printed on every quote, invoice and statement.",
        },
        {
            key: "tax", title: "Check your VAT rate and number", href: `${settings}/tax`, done: f.taxReviewed || f.hasVatNumber,
            why: "Set from your country when you signed up. Confirm it before the first invoice, since invoices keep the rate they were raised at.",
        },
        {
            key: "bank", title: "Add the bank details customers pay into", href: `${settings}/company`, done: f.hasBankDetails,
            why: "Printed under the invoice so EFT payments come with the right reference.",
        },
        {
            key: "hours", title: "Set your opening hours", href: `${settings}/booking`, done: f.hoursSet,
            why: "The diary and the mechanics' clock both work to them.",
        },
        {
            key: "team", title: "Invite your mechanics", href: `${settings}/users`, done: f.mechanics > 0,
            why: "Each one gets a lane on the diary and clocks on from their phone.",
        },
        {
            key: "customer", title: "Add your first customer and vehicle", href: `${base}/dashboard/customers/new`, done: f.customers > 0,
            why: "Everything else — jobs, inspections, reminders — hangs off them.",
        },
        {
            key: "job", title: "Open your first job card", href: `${base}/dashboard/customers`, done: f.jobs > 0,
            why: "Open a customer and start a job from their vehicle.",
        },
        {
            key: "logo", title: "Upload your logo", href: `${settings}/company`, done: f.hasLogo, optional: true,
            why: "Goes at the top of your documents.",
        },
        {
            key: "booking", title: "Take bookings online", href: `${settings}/booking`, done: f.onlineBooking, optional: true,
            why: "Customers pick a service and a time. Nothing lands in the diary until you approve it.",
        },
    ];
}

/** Done means every required step is done; optional ones never hold a workshop back. */
export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean } {
    const required = steps.filter((s) => !s.optional);
    const done = required.filter((s) => s.done).length;
    return { done, total: required.length, complete: done === required.length };
}
