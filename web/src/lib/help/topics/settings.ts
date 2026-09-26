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
                ["Change workshop settings", "Tax, company details, the hand-off, and the full data export"],
            ] },
            { kind: "note", text: "Contact details are removed on the server for anybody without that permission, before the page is built — not hidden in the markup. They are not in the page for somebody to find in the developer tools, and they are stripped from the exports too, so a download is never the way around a permission." },
            { kind: "h", text: "Adding somebody" },
            { kind: "p", text: "Settings → Team, invite by email. The link lasts seven days and works once. MOTION will not let the last owner be removed or demoted, and only an owner can make another owner." },
        ],
        related: ["first-hour"],
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
