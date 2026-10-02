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
        who: "A workshop running two or three bays",
        pitch: "The whole job, from the first phone call to the money in the bank.",
        includes: [
            "The booking diary, and a job card per car",
            "Quotes that become job cards and then invoices, without retyping",
            "Invoices, cash sales, credit notes and receipts, as PDFs",
            "Send anything by WhatsApp or email — no account needed at their end",
            "Customers, vehicles, licence disc and roadworthy dates",
            "What every customer owes, aged",
            "Profit on every job",
            "Mechanic clock-on, and the offline floor app",
            "Unlimited staff — MOTION works better when everyone is on it",
            "The help library and email support",
        ],
        excludes: ["Parts and stock", "Purchase orders and suppliers", "Inspections sent to the customer"],
        cta: { label: "Book a demo", href: "/support" },
    },
    {
        id: "full",
        name: "Full workshop",
        price: 2400,
        priceNote: "per month, excluding VAT",
        who: "Five to ten bays, with a parts counter",
        pitch: "Everything above, plus the parts, the suppliers and the reports an owner decides with.",
        includes: [
            "Everything in Workshop",
            "Stock on hand from a real movement ledger, not a number somebody edits",
            "Purchase orders, supplier invoices and what you owe them",
            "Stock takes, including blind counts",
            "Bundles, price matrices and serial numbers",
            "Inspections the customer approves on their phone",
            "Service and licence reminders",
            "Courtesy cars",
            "The eleven owner reports — profit by job, item sales, work in progress, quote outcomes",
        ],
        excludes: ["The council audit pack", "Accounting hand-off", "Installed on your own server"],
        cta: { label: "Book a demo", href: "/support" },
        featured: true,
    },
    {
        id: "council",
        name: "Council and multi-site",
        price: null,
        priceNote: "quoted per site",
        who: "Municipalities, fleets, and anyone running more than one workshop",
        pitch: "For the buyer whose procurement asks what happens if you stop existing.",
        includes: [
            "Everything in Full workshop",
            "The six exports a council audit asks for, filed as PDFs and re-addable as CSVs",
            "A number-sequence report that proves no document is missing",
            "The nightly journal into your accounting system — outbound only, nothing listening",
            "Every table as CSV in one archive, whenever you want it",
            "The public API, and separate sites that cannot see each other",
            "Installed on your own server, or hosted by us",
            "A named person, and an agreed response time",
        ],
        cta: { label: "Talk to us", href: "/support" },
    },
];

/** What is true whichever tier somebody is on. Said once, not three times. */
export const ALWAYS = [
    "Your data is yours. Take every table out as CSV, any time, without asking.",
    "No charge per user. A workshop should not ration logins.",
    "Namibian from the ground up: 15 % VAT, N$, licence disc, roadworthy, WhatsApp.",
    "Month to month. No setup fee to start.",
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
    name: "Getting started",
    pitch: "Your customers, vehicles and parts brought across from whatever you use now, and a morning with your staff.",
    note: "Quoted on the size of what is being moved. Not required — the import screen and the help library are built to be used without us.",
};
