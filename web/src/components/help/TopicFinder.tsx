"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SpineSection, Pill, PublicHero } from "@/components/public/spine";

/**
 * The help index: everything there is, and a way to make it smaller.
 *
 * The manual's own search lives in the masthead of an *article* and searches
 * full text. This is a different job. Somebody on the index is browsing, and
 * what they want is for seventeen topics to become three — so this filters
 * what is already on the page rather than navigating away. No round trip, no
 * results page, and sections that end up empty simply go.
 *
 * **Every word must match, not any.** "stock take" narrows rather than widening
 * to everything mentioning either, because that is what somebody typing two
 * words means. An OR would hand them more results for being more specific.
 *
 * It works before the JavaScript arrives. The full list is rendered on the
 * server and this only ever removes from it, so somebody on a slow connection
 * in a workshop gets the whole manual immediately and the filter a moment
 * later — rather than an empty box and a spinner.
 *
 * The hero lives here rather than in the page because the finder sits in it
 * and the sections it filters sit below it, and the two share state. The bar
 * is handed in from the server, since it reads the edition.
 */

export type FinderTopic = { slug: string; title: string; question: string; haystack: string };
export type FinderGroup = { id: string; label: string; topics: FinderTopic[] };

export function TopicFinder({
    bar,
    figure,
    groups,
    total,
}: {
    bar: ReactNode;
    figure?: ReactNode;
    groups: FinderGroup[];
    total: number;
}) {
    const [query, setQuery] = useState("");

    const { shown, count } = useMemo(() => {
        const words = query
            .trim()
            .toLowerCase()
            // Curly apostrophes are what a phone types and what the questions
            // are written with, so "can't" has to match “can’t”.
            .replace(/[‘’]/g, "'")
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) return { shown: groups, count: total };

        const kept = groups
            .map((g) => ({ ...g, topics: g.topics.filter((t) => words.every((w) => t.haystack.includes(w))) }))
            .filter((g) => g.topics.length > 0);

        return { shown: kept, count: kept.reduce((n, g) => n + g.topics.length, 0) };
    }, [groups, query, total]);

    const term = query.trim();

    return (
        <>
            <PublicHero
                bar={bar}
                pill={
                    <Pill>
                        <span className="tabular-nums">{total}</span> topics
                    </Pill>
                }
                title="Help"
                sub={`${total} topics, written as the questions people actually ring about. Every one opens with its answer in a single sentence.`}
                figure={figure}
                cta={
                    <div className="flex w-full flex-col gap-5">
                        <div role="search" className="flex w-full max-w-md flex-col gap-2">
                            <label htmlFor="topic-q" className="text-[0.875rem] font-semibold text-slate-900">
                                Find a topic
                            </label>
                            <div className="relative">
                                <Search
                                    aria-hidden
                                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                                    strokeWidth={1.75}
                                />
                                <input
                                    id="topic-q"
                                    type="search"
                                    autoComplete="off"
                                    placeholder="invoice, stock, payment…"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20"
                                />
                            </div>
                            {/* Polite, not assertive: this updates on every
                                keystroke, and assertive would interrupt a
                                screen reader on each letter typed. */}
                            <p aria-live="polite" className="text-[0.8125rem] text-slate-500">
                                {term ? (count === 1 ? "1 topic matches" : `${count} topics match`) : `Showing all ${total} topics`}
                            </p>
                        </div>

                        <nav aria-label="Help sections">
                            <ul className="flex max-w-xl flex-wrap gap-2">
                                {groups.map((g) => (
                                    <li key={g.id}>
                                        <a
                                            href={`#${g.id}`}
                                            className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-[0.95rem] text-[0.875rem] text-slate-900 hover:border-teal-600 hover:text-teal-700"
                                        >
                                            {g.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>
                }
            />

            <main>
                {shown.length === 0 && (
                    <SpineSection bend="left" label="No matching topics">
                        <p className="max-w-[46ch] text-[1.125rem] text-slate-900">
                            No topic matches “{term}”. Try one word, like <em>invoice</em> or <em>stock</em> — or{" "}
                            <Link
                                href="/support"
                                className="font-medium text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700"
                            >
                                ask support
                            </Link>
                            .
                        </p>
                    </SpineSection>
                )}

                {shown.map((group, i) => (
                    <SpineSection
                        key={group.id}
                        id={group.id}
                        bend={i % 2 === 0 ? "left" : "right"}
                        tint={i % 2 === 0}
                        labelledBy={`h-${group.id}`}
                    >
                        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
                            <div className="flex flex-col items-start gap-4">
                                <Pill>
                                    <span className="tabular-nums">{group.topics.length}</span>{" "}
                                    {group.topics.length === 1 ? "topic" : "topics"}
                                </Pill>
                                <h2
                                    id={`h-${group.id}`}
                                    className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900"
                                >
                                    {group.label}
                                </h2>
                            </div>

                            <ul className="grid gap-4 sm:grid-cols-2">
                                {group.topics.map((topic) => (
                                    <li key={topic.slug}>
                                        <Link
                                            href={`/help/${topic.slug}`}
                                            className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-[1.4rem] pb-[1.4rem] pt-5 text-slate-900 motion-safe:transition-transform motion-safe:duration-300 hover:-translate-y-0.5 hover:border-teal-600"
                                        >
                                            <span className="text-[0.875rem] font-medium text-slate-500">{topic.title}</span>
                                            {/* The question in the words somebody
                                                would say it. This is what makes the
                                                list scannable: a reader looks for
                                                the sentence already in their head. */}
                                            <span className="text-pretty text-[1.125rem] font-medium leading-[1.4] tracking-[-0.01em]">
                                                “{topic.question}”
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </SpineSection>
                ))}
            </main>
        </>
    );
}
