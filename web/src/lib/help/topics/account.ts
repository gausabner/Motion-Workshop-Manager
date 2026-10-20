import type { Topic } from "@/lib/help/content";

export const accountTopics: Topic[] = [
    {
        slug: "paying-for-motion",
        group: "account",
        title: "Paying for MOTION",
        question: "How do we pay for MOTION, and where are our tax invoices?",
        answer: "By EFT or bank deposit, using your workshop's payment reference. Every payment is confirmed by email with a tax invoice, and all your invoices are under Settings → Billing.",
        screens: ["/dashboard/settings/billing", "/activate"],
        blocks: [
            { kind: "p", text: "Your subscription is paid in Namibian dollars by EFT or bank deposit. Card payments are not available yet." },
            { kind: "h", text: "Each payment" },
            { kind: "steps", items: [
                "Pay the amount shown under Settings → Billing, using your payment reference. The reference is how we match the payment to your workshop.",
                "Send the proof of payment to the email address shown on the same page.",
                "We confirm the payment by email, with a tax invoice attached, and move your paid-up-to date forward.",
            ] },
            { kind: "h", text: "Reminders" },
            { kind: "p", text: "We email the workshop owner a week before the paid-up-to date, with the amount, the bank details and the reference. If the payment has not arrived seven days after that date, MOTION becomes read-only until it does." },
            { kind: "note", text: "Prices are quoted excluding VAT; the amount to pay includes VAT at 15%. Every tax invoice can be downloaded again from Settings → Billing." },
        ],
        related: ["read-only-and-paused", "changing-plan"],
    },
    {
        slug: "read-only-and-paused",
        group: "account",
        title: "Read-only and paused access",
        question: "Why can't we create invoices any more?",
        answer: "Your subscription payment is overdue, so MOTION is read-only: you can view, print and export everything, but cannot create quotes, job cards or invoices until the payment is received.",
        screens: ["/dashboard/settings/billing", "/paused"],
        blocks: [
            { kind: "h", text: "Read-only" },
            { kind: "p", text: "MOTION becomes read-only when a payment has not arrived seven days after the paid-up-to date. Everyone can still sign in, find every customer, vehicle and job, print documents and export your records. Creating quotes, job cards and invoices is paused until we confirm the payment, and full access returns straight away." },
            { kind: "h", text: "Paused access" },
            { kind: "p", text: "If a payment remains outstanding, access to the workshop can be paused. Anyone who signs in then sees the amount due and how to pay, instead of the workshop. The owner is emailed when access is paused and again when it is restored." },
            { kind: "note", text: "Nothing is deleted in either case. Your customers, vehicles, jobs, quotes and invoices are kept as they were, and are there when access returns." },
            { kind: "p", text: "If cash flow is difficult in a particular month, contact us before the date. We can usually make an arrangement." },
        ],
        related: ["paying-for-motion"],
    },
    {
        slug: "changing-plan",
        group: "account",
        title: "Changing plan",
        question: "How do we move to a different plan?",
        answer: "Choose Change plan under Settings → Billing. A move up is switched on once you have paid one month at the new price; a move down is applied when we approve it.",
        screens: ["/dashboard/settings/billing/change", "/dashboard/settings/billing"],
        blocks: [
            { kind: "p", text: "Owners and administrators can change plan. Features outside your plan are shown in the menu with a lock; selecting one opens Settings → Billing, which says which plan includes it and leads into the change." },
            { kind: "steps", items: [
                "Under Settings → Billing, choose Change plan, then the plan you want.",
                "Review what is added or locked and what it costs, then choose Request the change. We email you a confirmation, with the payment details for a move up.",
                "For a move up, pay the amount shown using your payment reference, and send the proof of payment. For a move down, there is nothing to pay.",
                "We apply the change and email you. A move up comes with its tax invoice.",
            ] },
            { kind: "table", head: ["", "What happens"], rows: [
                ["Moving up", "You pay one month at the new price. When we confirm the payment, the new features are switched on and your paid-up-to date restarts from that day. Days left on your previous period are not refunded."],
                ["Moving down", "No payment is needed. When we approve the change, the features the smaller plan does not include are locked, and your records in them are kept. The lower price applies from your next renewal."],
            ] },
            { kind: "note", text: "One request can be open at a time. You can withdraw it from Settings → Billing until we act on it; if you have already paid, contact us instead so that the payment can be matched." },
            { kind: "p", text: "The Council and multi-site plan is quoted per site. Contact us for a quote." },
        ],
        related: ["paying-for-motion"],
    },
];
