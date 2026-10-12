import type { Topic } from "@/lib/help/content";

export const startTopics: Topic[] = [
    {
        slug: "first-hour",
        group: "start",
        title: "The first hour",
        question: "I've just signed in — what do I do first?",
        answer: "Enter your company details, set your tax, import your customers, and raise one real job card.",
        screens: ["/dashboard"],
        blocks: [
            { kind: "p", text: "Work in this order, because each step makes the next easier. The dashboard shows a checklist of what is still to do, worked out from your data." },
            { kind: "steps", items: [
                "Settings → Company profile: your name, address, registration and tax numbers, and your logo. These print at the top of every document.",
                "Settings → Tax and terms: the tax name, the rate, and whether your prices include it. Each document keeps the settings it was raised under, so changing them later does not alter documents already raised.",
                "Settings → Import: import customers, vehicles, products and suppliers from a spreadsheet. MOTION recognises the columns, including the headings in a Workshop Software export, and shows what it will do before it does it.",
                "Raise one real job card, process it, and take the payment. Doing it once with a real vehicle is the quickest way to learn.",
            ] },
            { kind: "note", text: "Import your records before inviting staff. Staff who sign in to an empty system tend to go back to paper." },
        ],
        related: ["importing", "who-can-do-what"],
    },
    {
        slug: "importing",
        group: "start",
        title: "Importing your records",
        question: "How do I get my customers and parts out of my old system?",
        answer: "Export them as CSV, upload them at Settings → Import, and check what MOTION says it found before letting it run.",
        screens: ["/dashboard/settings/import"],
        blocks: [
            { kind: "p", text: "MOTION reads the column headings and recognises what each one holds, including the headings in a Workshop Software export. Before anything is saved, it shows what it matched, what it could not, and how many rows will be created and updated." },
            { kind: "h", text: "What to bring, in order" },
            { kind: "steps", items: [
                "Customers first, because vehicles attach to them.",
                "Vehicles second, matched to customers by name.",
                "Suppliers, then products, because products can name a supplier.",
            ] },
            { kind: "h", text: "Opening balances" },
            { kind: "p", text: "Amounts customers owed you when you moved are imported as internal invoices, marked so that they never appear in sales or profit figures." },
            { kind: "note", text: "Analyse the whole file rather than a sample. A column that is correct for the first fifty rows and wrong for row three hundred would not show up in a sample." },
        ],
        related: ["first-hour"],
    },
];
