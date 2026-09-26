import type { Topic } from "@/lib/help/content";

export const partsTopics: Topic[] = [
    {
        slug: "stock-on-hand",
        group: "parts",
        title: "How stock on hand is worked out",
        question: "Why does this part show a quantity I don't recognise?",
        answer: "Every movement is recorded, and the quantity is the sum of them — the number on the product is a cache of that sum, not the truth.",
        screens: ["/dashboard/products"],
        blocks: [
            { kind: "p", text: "MOTION keeps a ledger of stock movements: received on a supplier invoice, sold on a job, adjusted by hand, counted in a stocktake. The quantity you see on a product is the total of that ledger. It can always be rebuilt, and a movement is never deleted." },
            { kind: "h", text: "What moves stock" },
            { kind: "list", items: [
                "Processing a job card or invoice takes the parts off.",
                "Voiding one puts them back.",
                "Processing a supplier invoice brings them in.",
                "A hand adjustment, which always requires a reason.",
                "Applying a stocktake.",
            ] },
            { kind: "note", text: "Nothing moves stock while a document is a draft. A job card sitting open with six parts on it has not taken those parts off the shelf — which is why the shelf and the screen can disagree until it is processed." },
            { kind: "term", term: "Negative on hand", text: "The books think you sold more than you had. It is a counting error rather than a stock level, and it is left visible rather than clamped to zero so it can be found and fixed." },
        ],
        related: ["stocktake", "stock-valuation"],
    },
    {
        slug: "stocktake",
        group: "parts",
        title: "Counting the shelves",
        question: "How do I do a stocktake without stopping work?",
        answer: "Draw up a sheet, count onto it over as long as you like, and apply it — MOTION works the adjustment out against the ledger at the moment you apply, not the moment you started.",
        screens: ["/dashboard/products/stock-take"],
        blocks: [
            { kind: "p", text: "The awkward part of counting stock is that the workshop keeps trading while you do it. A sheet drawn up at nine in the morning is out of date by eleven, and applying it blindly would undo every sale made in between." },
            { kind: "h", text: "How it works" },
            { kind: "steps", items: [
                "Start a count, optionally narrowed to a shelf, a range of item codes or a group.",
                "Count onto the sheet. It saves as a draft; you can come back to it.",
                "Apply it. MOTION compares each counted line against what the ledger says now and posts the difference.",
            ] },
            { kind: "h", text: "Two things it does that matter" },
            { kind: "p", text: "A line that moved between the sheet being drawn up and the count being applied is flagged rather than silently written off, because the difference you counted is not the difference to post." },
            { kind: "p", text: "A line nobody counted is left alone. An unfinished sheet must never write every unvisited product down to nothing, and that is the single most expensive mistake a stocktake feature can make." },
            { kind: "term", term: "Blind count", text: "Hides what the system expects while you count, so people count what is there rather than confirming what the screen already says. Use it when the count matters." },
        ],
        related: ["stock-on-hand", "stock-valuation"],
    },
];
