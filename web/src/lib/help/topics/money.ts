import type { Topic } from "@/lib/help/content";

export const moneyTopics: Topic[] = [
    {
        slug: "taking-a-payment",
        group: "money",
        title: "Taking a payment",
        question: "How do I take a payment and put it against an invoice?",
        answer: "Record what actually arrived — cash, card, EFT or a split of them — then decide which invoices it settles.",
        screens: ["/dashboard/payments", "/dashboard/transactions"],
        blocks: [
            { kind: "p", text: "MOTION keeps two things apart that most systems muddle: the money that arrived, and what it was for. A customer can hand over N$5,000 against three invoices and a deposit on a fourth, and that is one receipt with four allocations." },
            { kind: "h", text: "Recording it" },
            { kind: "steps", items: [
                "Open the customer, or go to Payments and pick them.",
                "Enter what arrived, by method. A payment split across cash and card is two tenders on one receipt — that split is what gets reconciled later.",
                "Put a reference on each tender where there is one: the EFT reference, the card's last four.",
                "Allocate it against the open invoices, or leave it unapplied if they have paid ahead.",
            ] },
            { kind: "h", text: "Why a balance can never be wrong" },
            { kind: "p", text: "What an invoice has been paid is not stored on the invoice. It is worked out, every time you look, from the payments allocated to it. That is why a total and a balance can never drift apart — there is only one number, and the other is derived from it." },
            { kind: "note", text: "Cash change is recorded on the tender, not as a second transaction. If somebody pays N$500 cash on a N$430 invoice, the receipt records N$500 in and N$70 out, and the cash book shows what actually moved." },
        ],
        related: ["unapplied-credit", "what-customers-owe"],
    },
    {
        slug: "unapplied-credit",
        group: "money",
        title: "Deposits and money on account",
        question: "A customer paid before the invoice — where does it sit?",
        answer: "Unallocated, on their account, until there is an invoice to put it against.",
        screens: ["/dashboard/payments", "/dashboard/customers"],
        blocks: [
            { kind: "p", text: "Take the money as an ordinary receipt and allocate none of it. It sits on the customer's account as credit you are holding. When the job is invoiced, open the payment and allocate it." },
            { kind: "h", text: "Where to see it" },
            { kind: "p", text: "The customer's account panel shows what they owe and what is sitting unapplied, separately. On the debtors report the unapplied amount is netted into their current column, and the total says how much of the workshop's debtors figure is actually money already in the bank." },
            { kind: "note", text: "Unapplied credit is not the same as a credit note. Credit is money you are holding; a credit note is an invoice given back. The first is a payment, the second is a document." },
        ],
        related: ["taking-a-payment", "what-customers-owe"],
    },
    {
        slug: "what-customers-owe",
        group: "money",
        title: "Chasing what is owed",
        question: "Who owes us money, and how overdue is it?",
        answer: "Reports → Who owes us ages every unpaid invoice from its due date into current, 30, 60 and 90+.",
        screens: ["/dashboard/reports/receivables", "/dashboard/reports"],
        blocks: [
            { kind: "p", text: "Ageing runs from the due date, not the invoice date. An invoice on 30-day terms raised three weeks ago is not overdue, and a report that called it overdue would have you ringing a customer who has done nothing wrong." },
            { kind: "h", text: "Reading it" },
            { kind: "table", head: ["Column", "What it means"], rows: [
                ["Current", "Not due yet, or due today"],
                ["30 / 60", "Past its due date by that many days"],
                ["90+", "Three months and beyond — the column that decides whether you are still selling to them"],
                ["Oldest due", "The date of the oldest thing they owe on, which is what to open the conversation with"],
            ] },
            { kind: "p", text: "Every customer on the list has a WhatsApp button beside them that opens a message with their balance already in it." },
            { kind: "note", text: "An invoice with no due date on it is aged from the day it was posted, so nothing can hide by having its terms left blank." },
        ],
        related: ["unapplied-credit", "for-the-auditor"],
    },
];
