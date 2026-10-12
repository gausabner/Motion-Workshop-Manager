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
            { kind: "p", text: "Every screen and document checks a permission. Someone without the permission does not see that screen at all. (A screen shown with a lock is different: it belongs to a plan your workshop is not on.)" },
            { kind: "h", text: "The ones that matter most" },
            { kind: "table", head: ["Permission", "What it controls"], rows: [
                ["See cost and profit", "What things cost, margins, and most reports"],
                ["See customer contact details", "Addresses and telephone numbers. Names are always visible — a mechanic needs to know whose car is on the lift"],
                ["Take payments", "Receipts and refunds"],
                ["Void documents", "Cancelling a processed document, and deleting a stray one"],
                ["Change workshop settings", "Tax, company details, the accounting integration, and the full data export"],
            ] },
            { kind: "note", text: "Contact details are removed on the server for anyone without that permission, before the page is built, and they are removed from exports too. A download is never a way around a permission." },
            { kind: "h", text: "Adding a member of staff" },
            { kind: "p", text: "Invite people by email under Settings → Team. The invitation link is valid for seven days and can be used once. The last owner cannot be removed or demoted, and only an owner can make someone else an owner." },
        ],
        related: ["first-hour"],
    },
    {
        slug: "document-numbers",
        group: "settings",
        title: "Your invoice and document numbers",
        question: "Can I change how my invoices are numbered?",
        answer: "Yes, under Settings → Document numbers. Each kind of document has its own prefix and next number, and MOTION never issues a number twice.",
        screens: ["/dashboard/settings/numbering"],
        blocks: [
            { kind: "p", text: "Every kind of document — invoices, credit notes, quotes, job cards, receipts, refunds, inspections, purchase orders and supplier payments — has its own series: a prefix you choose and the number it continues from. A new workshop starts at INV-1001, Q-1001 and so on. The screen shows exactly what the next one will be called before you save." },
            { kind: "h", text: "Coming from another system" },
            { kind: "p", text: "Continue from where your old invoices stopped, so that your numbering runs without a break. If the last invoice in your old system was 4812, keep the prefix you used there and set the next number to 4813." },
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
        group: "customers",
        title: "Sending a document to a customer",
        question: "How does a customer get their invoice?",
        answer: "As a link sent by WhatsApp or email, which opens in their browser. They never need an account or a password.",
        screens: ["/dashboard/documents", "/dashboard/messages"],
        blocks: [
            { kind: "p", text: "MOTION creates a link to the document and opens WhatsApp or your email app with the message already written. The customer opens the link to see the document; there is no account, password or app." },
            { kind: "h", text: "What the link does" },
            { kind: "list", items: [
                "It expires, and you can revoke it at any time.",
                "When the customer opens it, MOTION records the document as delivered.",
                "Every send is logged against the customer and the document.",
            ] },
            { kind: "note", text: "A forwarded link works for whoever receives it, so revoke a link that was sent to the wrong number." },
        ],
        related: ["who-can-do-what"],
    },
];
