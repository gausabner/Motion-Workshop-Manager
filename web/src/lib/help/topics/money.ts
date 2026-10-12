import type { Topic } from "@/lib/help/content";

export const moneyTopics: Topic[] = [
    {
        slug: "taking-a-payment",
        group: "money",
        title: "Taking a payment",
        question: "How do I take a payment and put it against an invoice?",
        answer: "Record the money received, by method (cash, card, EFT or a combination), then choose which invoices it settles.",
        screens: ["/dashboard/payments", "/dashboard/transactions"],
        blocks: [
            { kind: "p", text: "MOTION records the money received separately from what it pays for. A customer can pay N$ 5,000.00 towards three invoices and a deposit on a fourth: that is one receipt with four allocations." },
            { kind: "h", text: "Recording it" },
            { kind: "steps", items: [
                "Open the customer, or go to Receipts and choose them.",
                "Enter the amount received, by method. A payment split between cash and card is two tenders on one receipt, which is what is reconciled later.",
                "Add a reference to each tender where there is one, such as the EFT reference or the last four digits of the card.",
                "Allocate it to the open invoices, or leave it unapplied if the customer has paid in advance.",
            ] },
            { kind: "h", text: "Why a balance can never be wrong" },
            { kind: "p", text: "The amount paid on an invoice is not stored on the invoice. It is calculated each time from the payments allocated to it, so the total and the balance cannot disagree." },
            { kind: "note", text: "Change given is recorded on the tender, not as a separate transaction. If a customer pays N$ 500.00 in cash for a N$ 430.00 invoice, the receipt records N$ 500.00 received and N$ 70.00 change, and the cash book shows both." },
        ],
        related: ["unapplied-credit", "what-customers-owe"],
    },
    {
        slug: "unapplied-credit",
        group: "money",
        title: "Deposits and money on account",
        question: "A customer paid before the invoice — where does it sit?",
        answer: "It stays on their account, unallocated, until there is an invoice to allocate it to.",
        screens: ["/dashboard/payments", "/dashboard/customers"],
        blocks: [
            { kind: "p", text: "Record the money as an ordinary receipt and allocate none of it. It stays on the customer's account as credit you are holding. When the job is invoiced, open the receipt and allocate it." },
            { kind: "h", text: "Where to see it" },
            { kind: "p", text: "The customer's account panel shows what they owe and what is unapplied, separately. On the Debtors report the unapplied amount is deducted in their current column, and the total shows how much of the debtors figure has already been received." },
            { kind: "note", text: "Unapplied credit is not a credit note. Unapplied credit is money you are holding for the customer; a credit note reverses all or part of an invoice." },
        ],
        related: ["taking-a-payment", "what-customers-owe"],
    },
    {
        slug: "what-customers-owe",
        group: "money",
        title: "Debtors",
        question: "Which customers owe us money, and how overdue is it?",
        answer: "Reports → Debtors ages every unpaid invoice from its due date into current, 30, 60 and 90+.",
        screens: ["/dashboard/reports/receivables", "/dashboard/reports"],
        blocks: [
            { kind: "p", text: "Ageing runs from the due date, not the invoice date. An invoice on 30-day terms raised three weeks ago is not yet overdue." },
            { kind: "h", text: "Reading it" },
            { kind: "table", head: ["Column", "What it means"], rows: [
                ["Current", "Not due yet, or due today"],
                ["30 / 60", "Past its due date by that many days"],
                ["90+", "Three months or more past its due date"],
                ["Oldest due", "The due date of the oldest amount they owe"],
            ] },
            { kind: "p", text: "Each customer on the list has a WhatsApp button that opens a message with their balance already written." },
            { kind: "note", text: "An invoice with no due date is aged from the date it was processed." },
        ],
        related: ["unapplied-credit", "for-the-auditor"],
    },
];
