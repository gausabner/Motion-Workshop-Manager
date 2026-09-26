import Link from "next/link";
import { byGroup, TOPICS } from "@/lib/help";

/**
 * The way in.
 *
 * The contents lead. Search lives in the masthead above, on every page of the
 * manual, which leaves this page free to do the thing the whole structure was
 * chosen for: set out everything there is, in full, so nobody has to already
 * know the right word to ask for.
 *
 * Not a grid of identical cards but the manual's own table of contents, each
 * entry carrying the question it answers, so the list can be scanned for a
 * sentence matching the one already in the reader's head.
 */
export default function HelpIndex() {
    const groups = byGroup();
    return (
        <div className="max-w-[68ch]">
            <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-slate-900">Help</h1>
            <p className="mt-3 text-[15px] leading-[1.7] text-slate-600">
                {TOPICS.length} topics, written as the questions people actually ring about. Every one opens with its answer in a
                single sentence.
            </p>

            <div className="mt-12 space-y-10">
                {groups.map((group) => (
                    <section key={group.id}>
                        <h2 className="border-b border-slate-200 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {group.label}
                        </h2>
                        <ul className="mt-1 divide-y divide-slate-100">
                            {group.topics.map((topic) => (
                                <li key={topic.slug}>
                                    <Link href={`/help/${topic.slug}`} className="group block py-3">
                                        <span className="block text-[15px] font-medium text-slate-900 underline-offset-4 group-hover:underline">
                                            {topic.title}
                                        </span>
                                        <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{topic.question}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}
