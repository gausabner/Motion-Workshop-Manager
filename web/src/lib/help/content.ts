/**
 * What a help article is made of.
 *
 * Content is **data, not markup**, and that is the decision the whole engine
 * rests on. The same article has to render as a page in the public manual, as
 * a panel over the screen somebody is stuck on, and as a row in a search
 * result — and it has to be searchable without shipping a second copy of
 * itself to an index somewhere.
 *
 * Prose in MDX would read better to write and would make all three of those
 * harder: a drawer would have to render a document built for a page, and
 * search would have to parse markup back into sentences. Blocks cost a little
 * ceremony at the writing end and buy every surface for free.
 *
 * No block carries styling. A block says what a thing *is* — a step, a
 * caution, a definition — and the renderer decides what that looks like here.
 */

export type Block =
    /** A paragraph. The workhorse. */
    | { kind: "p"; text: string }
    /** A heading inside an article. Becomes an anchor and an "on this page" entry. */
    | { kind: "h"; text: string }
    /** Numbered, because the order matters. Use for "do this, then this". */
    | { kind: "steps"; items: string[] }
    /** Unordered. Use when the order does not matter. */
    | { kind: "list"; items: string[] }
    /**
     * Something that will cost money or time if it is missed.
     *
     * Deliberately one tone rather than an info/warn/danger family: three
     * colours of callout on one page teaches the reader to ignore two of them.
     */
    | { kind: "note"; text: string }
    /** A word this workshop's staff will meet in the app and nowhere else. */
    | { kind: "term"; term: string; text: string }
    | { kind: "table"; head: string[]; rows: string[][] };

export const GROUPS = ["start", "job", "money", "parts", "reports", "settings"] as const;
export type GroupId = (typeof GROUPS)[number];

export const GROUP_LABELS: Record<GroupId, string> = {
    start: "Getting started",
    job: "The job",
    money: "Money",
    parts: "Parts and stock",
    reports: "Reports",
    settings: "Settings and people",
};

export type Topic = {
    slug: string;
    group: GroupId;
    /** The title in the rail and at the head of the page. */
    title: string;
    /**
     * The same thing as somebody would actually ask it out loud.
     *
     * This is what search matches on first, because a person stuck on a screen
     * types "why can't I delete this" and never "document lifecycle rules".
     */
    question: string;
    /**
     * The answer in one sentence, before any of the detail.
     *
     * It is what the drawer shows, what search shows under each hit, and what
     * somebody reads if they read nothing else. An article whose answer cannot
     * be written in one sentence is usually two articles.
     */
    answer: string;
    blocks: Block[];
    /**
     * Route fragments this topic answers for, matched against the path the
     * reader is on. This is what makes the in-app drawer open on the right
     * page instead of on a table of contents.
     */
    screens?: string[];
    related?: string[];
};

/** Every heading in an article, for the "on this page" rail. */
export function anchorsOf(topic: Topic): { id: string; text: string }[] {
    return topic.blocks
        .filter((b): b is Extract<Block, { kind: "h" }> => b.kind === "h")
        .map((b) => ({ id: slugify(b.text), text: b.text }));
}

export function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Everything in an article as one lowercase string, for matching against. */
export function haystack(topic: Topic): string {
    const fromBlocks = topic.blocks.map((b) => {
        switch (b.kind) {
            case "p":
            case "h":
            case "note":
                return b.text;
            case "steps":
            case "list":
                return b.items.join(" ");
            case "term":
                return `${b.term} ${b.text}`;
            case "table":
                return [...b.head, ...b.rows.flat()].join(" ");
        }
    });
    return [topic.title, topic.question, topic.answer, ...fromBlocks].join(" ").toLowerCase();
}
