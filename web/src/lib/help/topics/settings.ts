import type { Topic } from "@/lib/help/content";

export const settingsTopics: Topic[] = [
    {
        slug: "who-can-do-what",
        group: "settings",
        title: "Who can see and do what",
        question: "How do I stop a mechanic seeing what things cost?",
        answer: "Roles decide it. Put them on the role that fits and grant the one or two extras they actually need.",
        screens: ["/dashboard/settings/users"],
        blocks: [
            { kind: "p", text: "Every screen and every document checks a permission. Somebody without it does not see a locked button — the page is simply not there for them." },
            { kind: "h", text: "The ones that matter most" },
            { kind: "table", head: ["Permission", "What it controls"], rows: [
                ["See cost and profit", "What things cost, margins, and most reports"],
                ["See customer contact details", "Addresses and telephone numbers. Names are always visible — a mechanic needs to know whose car is on the lift"],
                ["Take payments", "Receipts and refunds"],
                ["Void documents", "Cancelling a processed document, and deleting a stray one"],
                ["Change workshop settings", "Tax, company details, the accounting integration, and the full data export"],
            ] },
            { kind: "note", text: "Contact details are removed on the server for anybody without that permission, before the page is built — not hidden in the markup. They are not in the page for somebody to find in the developer tools, and they are stripped from the exports too, so a download is never the way around a permission." },
            { kind: "h", text: "Adding somebody" },
            { kind: "p", text: "Settings → Team, invite by email. The link lasts seven days and works once. MOTION will not let the last owner be removed or demoted, and only an owner can make another owner." },
        ],
        related: ["first-hour"],
    },
    {
        slug: "document-numbers",
        group: "settings",
        title: "Your invoice and document numbers",
        question: "Can I change how my invoices are numbered?",
        answer: "Yes — Settings → Document numbers. Each kind of document has its own prefix and next number, and MOTION never issues a number twice.",
        screens: ["/dashboard/settings/numbering"],
        blocks: [
            { kind: "p", text: "Every kind of document — invoices, credit notes, quotes, job cards, receipts, refunds, inspections, purchase orders and supplier payments — has its own series: a prefix you choose and the number it continues from. A new workshop starts at INV-1001, Q-1001 and so on. The screen shows exactly what the next one will be called before you save." },
            { kind: "h", text: "Coming from another system" },
            { kind: "p", text: "Carry on where your old invoices stopped, so your books run on without a break. If the last invoice in your old system was 4812, keep the prefix you used there and set the next number to 4813." },
            { kind: "h", text: "What MOTION will not let you do" },
            { kind: "list", items: [
                "Issue a number twice. A series can only continue above the highest number already issued with its prefix.",
                "Give two kinds of document the same prefix. A number has to say what it is.",
                "Renumber a document that already has a number. A change applies from the next document on.",
            ] },
            { kind: "note", text: "A new prefix can start from any number, because nothing has been issued with it yet. Going back to a prefix you used before means continuing after the last number it issued." },
        ],
        related: ["who-can-do-what"],
    },
    {
        slug: "sending-documents",
        group: "settings",
        title: "Sending a document to a customer",
        question: "How does a customer get their invoice?",
        answer: "As a link that opens in their browser, handed to WhatsApp or email — they never need an account or a password.",
        screens: ["/dashboard/documents", "/dashboard/messages"],
        blocks: [
            { kind: "p", text: "MOTION mints a link for the document and hands it to WhatsApp or your mail app with the message already written. The customer taps it and sees the document. No account, no password, no app to install." },
            { kind: "h", text: "What the link does" },
            { kind: "list", items: [
                "It expires, and you can revoke it at any time.",
                "Opening it is the delivery signal — that is how MOTION knows it arrived rather than assuming.",
                "Every send is logged against the customer and the document.",
            ] },
            { kind: "note", text: "Because the link is the delivery, there is nothing to configure and no account to pay for. It also means a link forwarded to somebody else works for them too, so revoke one that went to the wrong number." },
        ],
        related: ["who-can-do-what"],
    },
];
