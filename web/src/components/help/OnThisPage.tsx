"use client";

import { useEffect, useState } from "react";

/**
 * Where you are inside a long article.
 *
 * Hidden below the widest breakpoint: on a laptop the third column costs the
 * article its measure, and the phone already has the contents disclosure. A
 * reference rail that squeezes the thing it references is a rail that should
 * not be there.
 *
 * The active heading is tracked with an observer rather than on scroll
 * position, so it costs nothing while the reader is simply reading.
 */
export function OnThisPage({ anchors }: { anchors: { id: string; text: string }[] }) {
    const [active, setActive] = useState<string | null>(anchors[0]?.id ?? null);

    useEffect(() => {
        if (anchors.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible) setActive(visible.target.id);
            },
            // A band near the top: a heading counts as "where you are" once it
            // reaches the upper quarter, not when it first peeks in at the foot.
            { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
        );
        for (const a of anchors) {
            const el = document.getElementById(a.id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [anchors]);

    if (anchors.length < 2) return null;

    return (
        <nav aria-label="On this page" className="sticky top-24">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On this page</p>
            <ul className="mt-2 space-y-px">
                {anchors.map((a) => (
                    <li key={a.id}>
                        <a
                            href={`#${a.id}`}
                            className={`-ml-px block border-l py-1 pl-3 text-[12px] leading-snug transition-colors ${
                                active === a.id
                                    ? "border-teal-700 text-slate-900"
                                    : "border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800"
                            }`}
                        >
                            {a.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
