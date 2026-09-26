"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { GroupId, Topic } from "@/lib/help/content";

/**
 * Every topic, visible at once.
 *
 * That is the whole argument for this shape: the reader does not have to
 * already know the right word to search for, because the contents are the
 * page furniture rather than something behind a query.
 *
 * The named risk of a manual is the phone, and this app is used by mechanics
 * on phones. So below the tablet breakpoint the rail is not a rail: it
 * collapses to one disclosure that says where you are, and the article gets
 * the whole screen. Shrinking a three-column manual into 375px is how a
 * reference becomes unreadable.
 */

export function TopicRail({ groups }: { groups: { id: GroupId; label: string; topics: Topic[] }[] }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const current = groups.flatMap((g) => g.topics).find((t) => pathname.endsWith(`/help/${t.slug}`));

    const list = (
        <nav className="space-y-5">
            {groups.map((group) => (
                <div key={group.id}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{group.label}</p>
                    <ul className="mt-2 space-y-px">
                        {group.topics.map((topic) => {
                            const active = pathname.endsWith(`/help/${topic.slug}`);
                            return (
                                <li key={topic.slug}>
                                    <Link
                                        href={`/help/${topic.slug}`}
                                        onClick={() => setOpen(false)}
                                        aria-current={active ? "page" : undefined}
                                        className={`-ml-px block border-l py-1 pl-3 text-[13px] transition-colors ${
                                            active
                                                ? "border-teal-700 font-medium text-slate-900"
                                                : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                                        }`}
                                    >
                                        {topic.title}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );

    // On the index the contents are already printed down the page, so the
    // disclosure would expand to a second copy of the same seventeen topics —
    // doubling the density the phone layout exists to avoid.
    const onIndex = pathname === "/help" || pathname === "/help/";

    return (
        <>
            {/* Phone: one disclosure that names where you are. */}
            <div className={`border-b border-slate-200 lg:hidden ${onIndex ? "hidden" : ""}`}>
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                    <span className="min-w-0">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contents</span>
                        <span className="block truncate text-[13px] font-medium text-slate-900">{current?.title ?? "All topics"}</span>
                    </span>
                    <ChevronDown
                        aria-hidden
                        strokeWidth={1.75}
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    />
                </button>
                {open && <div className="px-4 pb-5">{list}</div>}
            </div>

            {/* Desktop: the rail proper. */}
            <div className="hidden lg:block">{list}</div>
        </>
    );
}
