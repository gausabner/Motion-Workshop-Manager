import { GROUPS, GROUP_LABELS, haystack, type GroupId, type Topic } from "@/lib/help/content";
import { startTopics } from "@/lib/help/topics/start";
import { jobTopics } from "@/lib/help/topics/job";
import { moneyTopics } from "@/lib/help/topics/money";
import { partsTopics } from "@/lib/help/topics/parts";
import { reportTopics } from "@/lib/help/topics/reports";
import { settingsTopics } from "@/lib/help/topics/settings";

/**
 * The library, and the three ways in.
 *
 * Deliberately a plain module rather than anything loaded at runtime: the help
 * ships inside the bundle, so it works on a council network with no internet,
 * in the offline floor app, and in a browser tab that lost its connection
 * halfway through a job. A hosted search index would be faster to build and
 * would be the one part of MOTION that stops working exactly when somebody is
 * most stuck.
 */

export * from "@/lib/help/content";

export const TOPICS: Topic[] = [
    ...startTopics, ...jobTopics, ...moneyTopics,
    ...partsTopics, ...reportTopics, ...settingsTopics,
];

export const byGroup = (): { id: GroupId; label: string; topics: Topic[] }[] =>
    GROUPS.map((id) => ({ id, label: GROUP_LABELS[id], topics: TOPICS.filter((t) => t.group === id) }))
        .filter((g) => g.topics.length > 0);

export const topicBySlug = (slug: string): Topic | undefined => TOPICS.find((t) => t.slug === slug);

/**
 * What to offer somebody standing on a given screen.
 *
 * Longest match wins, so a topic claiming `/dashboard/reports/audit` beats one
 * claiming `/dashboard/reports`. This is the whole trick behind the drawer: the
 * reader never chooses a topic, they press Help and the right page is already
 * open.
 *
 * Where two topics claim the same screen at the same depth — the audit screen
 * is claimed by both the overview and the gap report — the one declared first
 * in its group leads and the rest are offered beside it. That makes the order
 * topics are written in the priority order for the drawer, which is worth
 * knowing before reshuffling a file.
 */
export function topicsForPath(path: string): Topic[] {
    const scored = TOPICS
        .map((topic) => {
            const best = (topic.screens ?? [])
                .filter((screen) => path.includes(screen))
                .reduce((longest, screen) => Math.max(longest, screen.length), 0);
            return { topic, best };
        })
        .filter((s) => s.best > 0)
        .sort((a, b) => b.best - a.best);
    return scored.map((s) => s.topic);
}

/**
 * Search, computed in the browser over content that already shipped.
 *
 * Ranked rather than filtered, because the reader's words are rarely the
 * article's words. A question match outranks a title match, which outranks a
 * body match — somebody typing "why can't I delete this" should land on the
 * article whose question is that sentence, not on the first article that
 * happens to contain the word "delete".
 */
export type Hit = { topic: Topic; score: number };

export function search(query: string, limit = 8): Hit[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    // Words rather than the whole phrase: "delete invoice" should find an
    // article about deleting documents even though that exact pair never
    // appears in it.
    const words = q.split(/\s+/).filter((w) => w.length > 1);

    return TOPICS
        .map((topic): Hit => {
            const question = topic.question.toLowerCase();
            const title = topic.title.toLowerCase();
            const body = haystack(topic);
            let score = 0;
            if (question.includes(q)) score += 100;
            if (title.includes(q)) score += 60;
            if (topic.answer.toLowerCase().includes(q)) score += 40;
            for (const word of words) {
                if (question.includes(word)) score += 12;
                if (title.includes(word)) score += 8;
                if (body.includes(word)) score += 2;
            }
            // Every word present somewhere beats a single word repeated.
            if (words.length > 1 && words.every((w) => body.includes(w))) score += 15;
            return { topic, score };
        })
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title))
        .slice(0, limit);
}
