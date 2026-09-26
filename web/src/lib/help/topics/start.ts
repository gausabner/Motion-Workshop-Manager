import type { Topic } from "@/lib/help/content";

export const startTopics: Topic[] = [
    {
        slug: "first-hour",
        group: "start",
        title: "The first hour",
        question: "I've just signed in — what do I do first?",
        answer: "Put your details on an invoice, set your tax, bring your customers across, and raise one real job card.",
        screens: ["/dashboard"],
        blocks: [
            { kind: "p", text: "In this order, because each one makes the next easier. The dashboard keeps a checklist of what is still outstanding, worked out from your data rather than ticked off by hand." },
            { kind: "steps", items: [
                "Settings → Company: your name, address, registration and tax numbers, and your logo. This is what prints at the top of every document, so it is worth ten minutes.",
                "Settings → Tax: the tax name, the rate, and whether your prices include it. Every document raised from now on is stamped with these — changing them later does not alter anything already raised.",
                "Settings → Import: bring customers, vehicles, products and suppliers across from a spreadsheet. MOTION guesses the columns, including a Workshop Software export's own headings, and shows you what it will do before it does it.",
                "Raise one real job card, process it, and take the payment. Doing it once on a real car teaches more than reading about it.",
            ] },
            { kind: "note", text: "Import before you invite anybody. A workshop whose staff sign in to an empty system go back to the paper book, and getting them a second time is much harder." },
        ],
        related: ["importing", "who-can-do-what"],
    },
    {
        slug: "importing",
        group: "start",
        title: "Bringing your data across",
        question: "How do I get my customers and parts out of my old system?",
        answer: "Export them as CSV, upload them at Settings → Import, and check what MOTION says it found before letting it run.",
        screens: ["/dashboard/settings/import"],
        blocks: [
            { kind: "p", text: "MOTION reads the column headings and guesses what each one is, including the headings Workshop Software exports with. You get a summary of what it matched, what it could not, and how many rows will be created against updated — before anything is written." },
            { kind: "h", text: "What to bring, in order" },
            { kind: "steps", items: [
                "Customers first, because vehicles attach to them.",
                "Vehicles second, matched to customers by name.",
                "Suppliers, then products, because products can name a supplier.",
            ] },
            { kind: "h", text: "Opening balances" },
            { kind: "p", text: "What customers already owed you when you moved comes in as internal invoices — marked as such so they never appear in a sales or profit figure as though the work were done here." },
            { kind: "note", text: "Run the analysis on the whole file rather than a sample. A column that is right for the first fifty rows and wrong for row three hundred is exactly the case a sample hides." },
        ],
        related: ["first-hour"],
    },
];
