import { Info } from "lucide-react";
import { slugify, type Block, type Topic } from "@/lib/help/content";

/**
 * One article, rendered from blocks.
 *
 * The measure is held at 68 characters. Help is read by somebody who is
 * already interrupted, and a line that runs the width of a desktop monitor
 * loses its place on every return sweep — which is the one thing this surface
 * cannot afford.
 *
 * `compact` is the drawer: the same article, a step down in scale, with the
 * answer still leading. Not a different component and not different content,
 * because two renderings of one article is how they come to disagree.
 */

function Blocks({ blocks, compact }: { blocks: Block[]; compact: boolean }) {
    const body = compact ? "text-[13px] leading-[1.65]" : "text-[15px] leading-[1.7]";
    return (
        <>
            {blocks.map((block, i) => {
                switch (block.kind) {
                    case "h":
                        return (
                            <h2
                                key={i}
                                id={slugify(block.text)}
                                className={`scroll-mt-24 font-semibold tracking-tight text-slate-900 ${compact ? "mt-6 text-[14px]" : "mt-9 text-[19px]"} first:mt-0`}
                            >
                                {block.text}
                            </h2>
                        );

                    case "p":
                        return <p key={i} className={`mt-3 text-slate-700 ${body}`}>{block.text}</p>;

                    case "steps":
                        // Numbered because the order carries meaning. The
                        // numeral is tabular so a list running past nine keeps
                        // its text aligned.
                        return (
                            <ol key={i} className="mt-4 space-y-2.5">
                                {block.items.map((item, n) => (
                                    <li key={n} className="flex gap-3">
                                        <span className="mt-px w-4 shrink-0 text-right text-[12px] font-semibold tabular-nums text-teal-700">{n + 1}</span>
                                        <span className={`text-slate-700 ${body}`}>{item}</span>
                                    </li>
                                ))}
                            </ol>
                        );

                    case "list":
                        return (
                            <ul key={i} className="mt-4 space-y-2">
                                {block.items.map((item, n) => (
                                    <li key={n} className="flex gap-3">
                                        {/* A rule, not a bullet glyph: the page is built from hairlines. */}
                                        <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-slate-300" />
                                        <span className={`text-slate-700 ${body}`}>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        );

                    case "note":
                        return (
                            <p key={i} className={`mt-5 flex gap-2.5 border-y border-slate-200 bg-slate-50/70 px-3 py-2.5 text-slate-700 ${body}`}>
                                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                                <span>{block.text}</span>
                            </p>
                        );

                    case "term":
                        return (
                            <dl key={i} className="mt-5 border-l border-slate-300 pl-3">
                                <dt className="text-[13px] font-semibold text-slate-900">{block.term}</dt>
                                <dd className={`mt-1 text-slate-600 ${body}`}>{block.text}</dd>
                            </dl>
                        );

                    case "table":
                        return (
                            <div key={i} className="mt-5 overflow-x-auto border border-slate-200">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {block.head.map((h) => (
                                                <th key={h} className="border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {block.rows.map((row, n) => (
                                            <tr key={n}>
                                                {row.map((cell, c) => (
                                                    <td key={c} className={`px-3 py-2 align-top ${compact ? "text-[12px]" : "text-[13px]"} ${c === 0 ? "font-medium text-slate-800" : "text-slate-600"}`}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                }
            })}
        </>
    );
}

export function Article({ topic, compact = false }: { topic: Topic; compact?: boolean }) {
    return (
        <article className={compact ? "" : "max-w-[68ch]"}>
            <h1 className={`font-semibold tracking-tight text-slate-900 ${compact ? "text-[17px]" : "text-[30px] leading-tight"}`}>
                {topic.title}
            </h1>

            {/* The answer, before anything else. Somebody who reads one
                sentence and leaves should still have been helped. */}
            <p className={`mt-3 border-l border-teal-700 pl-3 text-slate-800 ${compact ? "text-[13px] leading-[1.6]" : "text-[17px] leading-[1.6]"}`}>
                {topic.answer}
            </p>

            <div className="mt-6">
                <Blocks blocks={topic.blocks} compact={compact} />
            </div>
        </article>
    );
}
