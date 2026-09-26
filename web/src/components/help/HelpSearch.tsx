"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { search } from "@/lib/help";

/**
 * Search, over content that already shipped with the page.
 *
 * No index to host and nothing to call, which is the point: the one moment
 * somebody needs help most is the moment the network is least likely to be
 * there. On a council install there is no internet at all.
 *
 * Results appear under the field as you type and are driven with the
 * keyboard, because a person who has just typed a question has their hands in
 * the right place already and reaching for the mouse to pick the first result
 * is a small insult.
 */
export function HelpSearch({ autoFocus = false }: { autoFocus?: boolean }) {
    const [q, setQ] = useState("");
    const [cursor, setCursor] = useState(0);
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const box = useRef<HTMLDivElement>(null);

    const hits = useMemo(() => search(q), [q]);
    const showing = open && q.trim().length >= 2;

    useEffect(() => {
        const away = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", away);
        return () => document.removeEventListener("mousedown", away);
    }, []);

    const go = (slug: string) => {
        setOpen(false);
        setQ("");
        router.push(`/help/${slug}`);
    };

    return (
        <div ref={box} className="relative">
            <div className="flex items-center gap-2 border border-slate-300 bg-white px-3 focus-within:border-teal-700">
                <Search aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                    autoFocus={autoFocus}
                    role="combobox"
                    aria-expanded={showing}
                    aria-controls="help-search-results"
                    aria-activedescendant={showing && hits[cursor] ? `help-hit-${hits[cursor].topic.slug}` : undefined}
                    aria-autocomplete="list"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setCursor(0); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
                        if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                        if (e.key === "Enter" && hits[cursor]) { e.preventDefault(); go(hits[cursor].topic.slug); }
                        if (e.key === "Escape") setOpen(false);
                    }}
                    // 16px on the input itself: anything smaller and iOS Safari
                    // zooms the page the moment it is tapped.
                    className="h-10 w-full bg-transparent text-[16px] text-slate-900 placeholder:text-slate-500 focus:outline-none sm:text-[14px]"
                    placeholder="Ask it the way you would say it"
                    aria-label="Search help"
                />
            </div>

            {showing && (
                <div id="help-search-results" role="listbox" aria-label="Help results" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
                    {hits.length === 0 ? (
                        <p className="px-3 py-3 text-[13px] text-slate-500">
                            Nothing matches that yet. Try the words you would use out loud — &ldquo;deposit&rdquo;, &ldquo;void&rdquo;, &ldquo;who owes&rdquo;.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {hits.map((hit, i) => (
                                <li key={hit.topic.slug} id={`help-hit-${hit.topic.slug}`} role="option" aria-selected={i === cursor}>
                                    <Link
                                        href={`/help/${hit.topic.slug}`}
                                        onClick={() => { setOpen(false); setQ(""); }}
                                        onMouseEnter={() => setCursor(i)}
                                        className={`block px-3 py-2.5 ${i === cursor ? "bg-slate-50" : ""}`}
                                    >
                                        <span className="block text-[13px] font-medium text-slate-900">{hit.topic.question}</span>
                                        <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{hit.topic.answer}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                    {hits.length > 0 && (
                        <p className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
                            <span>{hits.length} {hits.length === 1 ? "answer" : "answers"}</span>
                            {/* Words rather than arrow glyphs: this is read by a
                                service advisor, not by somebody who already knows
                                what a caret means. */}
                            <span className="hidden sm:inline">Arrow keys to move, Enter to open</span>
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
