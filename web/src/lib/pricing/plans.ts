/**
 * What MOTION costs, and what each price buys.
 *
 * Written as data rather than as markup because the same three facts are
 * needed in three places — the pricing page, a proposal, and the sentence a
 * salesperson says out loud — and a tier that reads differently in two of them
 * is how a customer ends up owed something nobody meant to sell.
 *
 * Prices are monthly, in Namibian dollars, **excluding VAT**. The floor is
 * N$1,200: below that the support volume at these margins does not work, and
 * the workshops who would only ever pay less are the ones who go back to Excel
 * anyway.
 *
 * "Excluding VAT" is the honest phrasing because the supplier is registered for
 * it — Omzizi Investment CC, VAT 06658872-015 — so 15 % is added and the
 * invoice is a tax invoice a workshop can claim against. Quoting the headline
 * before tax is the convention this business already uses on its own
 * quotations, and the audience is other VAT-registered businesses who read
 * prices that way.
 *
 * What must not happen is a customer meeting the 15 % for the first time at the
 * bank, so the inclusive figure is shown underneath — computed, not typed. Two
 * numbers that can drift apart are how a published price and an invoiced amount
 * end up disagreeing.
 */

export type Plan = {
    id: string;
    name: string;
    /** Null where the price is a conversation rather than a number. */
    price: number | null;
    priceNote: string;
    /** Who this is for, in their own terms — bays, not seats. */
    who: string;
    /** The sentence that decides whether to read the list. */
    pitch: string;
    includes: string[];
    /** Named so the next tier up is a decision rather than a mystery. */
    excludes?: string[];
    cta: { label: string; href: string };
    /** The one people should land on. */
    featured?: boolean;
};

export const CURRENCY = "N$";

/**
 * Namibian VAT, as a percentage.
 *
 * The same 15 % the product applies to a workshop's own invoices, but reached
 * independently and deliberately not shared: this is the supplier's rate on a
 * subscription, while a workshop's rate is a per-tenant setting it may change.
 * One constant serving both would tie a customer's tax configuration to ours.
 */
export const VAT_RATE = 15;

/** What actually leaves the bank account. Rounded to the cent, because money is. */
export function withVat(price: number): number {
    return Math.round(price * (1 + VAT_RATE / 100) * 100) / 100;
}

export const PLANS: Plan[] = [
    {
        id: "workshop",
        name: "Workshop",
        price: 1200,
        priceNote: "per month, excluding VAT",
        who: "For workshops with two or three bays",
        pitch: "Every job, from the first call to the payment, on one document.",
        includes: [
            "The booking diary, with a job card for each vehicle",
            "Quotes that become job cards and invoices without re-entry",
            "Invoices, cash sales, credit notes and receipts as PDFs",
            "Documents sent by WhatsApp or email; your customer needs no account",
            "Customers and vehicles, with licence disc and roadworthy dates",
            "Aged debtors",
            "Profit on every job",
            "Mechanic time recording, with a floor app that works offline",
            "Unlimited staff",
            "The help library and email support",
        ],
        excludes: ["Parts and stock", "Purchasing and suppliers", "Inspections approved by the customer"],
        cta: { label: "Register on Workshop", href: "/register?plan=workshop" },
    },
    {
        id: "full",
        name: "Full workshop",
        price: 2400,
        priceNote: "per month, excluding VAT",
        who: "For workshops with five to ten bays and a parts counter",
        pitch: "Everything in Workshop, plus parts, purchasing and management reports.",
        includes: [
            "Everything in Workshop",
            "Stock levels calculated from every movement, never edited by hand",
            "Purchase orders, supplier invoices and creditors",
            "Stock takes, including blind counts",
            "Bundles, price matrices and serial numbers",
            "Inspections the customer approves on their phone",
            "Service and licence reminders, and campaigns",
            "Courtesy cars",
            "Eleven management reports, including profit by job, item sales, work in progress and quote outcomes",
        ],
        excludes: ["Audit reports", "Accounting integration", "Installation on your own server"],
        cta: { label: "Register on Full workshop", href: "/register?plan=full" },
        featured: true,
    },
    {
        id: "council",
        name: "Council and multi-site",
        price: null,
        priceNote: "quoted per site",
        who: "For municipalities, fleets and multi-site operators",
        pitch: "For organisations that require installation on their own servers and audit reporting.",
        includes: [
            "Everything in Full workshop",
            "The six reports a council audit requires, as PDFs with CSV copies",
            "A number-sequence report showing that no document is missing",
            "A nightly journal to your accounting system, sent outbound only",
            "Every table as CSV in a single archive, at any time",
            "The public API, and separate sites with isolated records",
            "Installation on your own server, or hosting by us",
            "A named contact and an agreed response time",
        ],
        cta: { label: "Request a quote", href: "/support" },
    },
];

/** What is true whichever plan somebody is on. Said once, not three times. */
export const ALWAYS = [
    "Your data is yours. Export every table as CSV at any time, without asking.",
    "No charge per user. Every member of staff can have their own sign-in.",
    "Built for Namibia. 15% VAT, Namibian dollars, licence discs, roadworthy certificates and WhatsApp.",
    "Month to month. No setup fee and no notice period.",
];

/**
 * Onboarding is sold, not bundled.
 *
 * At these prices support volume is the binding constraint on the business,
 * and the hours that go into importing somebody's history and sitting with
 * their staff are the most expensive hours there are. Bundling them into
 * N$1,200 prices the second customer out of existence.
 */
export const CARE = {
    name: "Moving from another system",
    pitch: "We import your customers, vehicles and parts from your current system, and spend a morning training your staff.",
    note: "Quoted according to the amount of data to be moved. It is optional: the import screen and the help library are designed to be used without us.",
};

/**
 * The questions a buyer asks before paying, answered on the pricing page.
 *
 * Every answer must match the terms and the product as built — the grace
 * period is `BILLING_GRACE_DAYS`, plan changes take effect as the admin
 * screen applies them, and exporting needs no request. Change the product and
 * this together.
 */
export const QUESTIONS: { q: string; a: string }[] = [
    {
        q: "How do I pay?",
        a: "By EFT or bank deposit, using the payment reference we email you when you register. Card payments are not available yet.",
    },
    {
        q: "When can we start using MOTION?",
        a: "As soon as your first payment is confirmed, usually on the same working day. Send the proof of payment to speed this up.",
    },
    {
        q: "Is there a contract?",
        a: "No. Subscriptions run month to month. Tell us when you want to stop, and your subscription ends at the end of the month you have paid for. There is no exit fee.",
    },
    {
        q: "Will we receive a tax invoice?",
        a: "Yes. Every payment is confirmed by email with a tax invoice attached, and all your invoices are kept under Settings → Billing.",
    },
    {
        q: "Can we change plan later?",
        a: "Yes. Features are added or removed as soon as the change is made, and the new price applies from your next renewal. Moving to a smaller plan keeps all your records.",
    },
    {
        q: "What happens if a payment is late?",
        a: "We send a reminder a week before the renewal date. If the payment has not arrived seven days after that date, MOTION becomes read-only: you can still view, print and export everything, but cannot create new documents until the payment is received.",
    },
    {
        q: "Can we take our data with us?",
        a: "Yes, at any time and without asking. Every table can be exported as a spreadsheet, with a file explaining how they relate.",
    },
    {
        q: "Do you offer a demonstration?",
        a: "Yes. A 30-minute demonstration by call or at your workshop, using one of your recent jobs. Book it through the support page.",
    },
];
