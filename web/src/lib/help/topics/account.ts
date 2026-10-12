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
        answer: "Email us from Settings → Billing. The features change on the day we change your plan, and the new price applies from your next renewal.",
        screens: ["/dashboard/settings/billing"],
        blocks: [
            { kind: "p", text: "Features outside your plan are shown in the menu with a lock. Selecting one opens Settings → Billing, which says which plan includes it and how to ask for the change." },
            { kind: "table", head: ["", "What happens"], rows: [
                ["Moving up", "The new features are available from the day we change your plan. The new price applies from your next renewal."],
                ["Moving down", "The features the smaller plan does not include are locked, and your records in them are kept. The lower price applies from your next renewal."],
            ] },
            { kind: "p", text: "The owner is emailed when the plan changes, listing what was added or locked and the price from the next renewal. Amounts already paid are not affected." },
        ],
        related: ["paying-for-motion"],
    },
];
