import Link from "next/link";
import { notFound } from "next/navigation";
import { anchorsOf, topicBySlug, TOPICS } from "@/lib/help";
import { Article } from "@/components/help/Article";
import { OnThisPage, ReadingProgress } from "@/components/help/OnThisPage";

/** Every topic ships as a static page: no database, no network, nothing to fail. */
export function generateStaticParams() {
    return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const topic = topicBySlug(slug);
    if (!topic) return { title: "Help | MOTION Workshop Manager" };
    return { title: `${topic.title} | MOTION Help`, description: topic.answer };
}

export default async function HelpTopicPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const topic = topicBySlug(slug);
    if (!topic) notFound();

    const anchors = anchorsOf(topic);
    const related = (topic.related ?? []).map(topicBySlug).filter((t) => t !== undefined);

    return (
        <div className="xl:flex xl:gap-10">
            <ReadingProgress target="help-article" />
            <div className="min-w-0 flex-1">
                {/* No "all topics" link here on a phone: the contents
                    disclosure directly above already names where you are and
                    opens the list, and two ways back stacked in 100px is one
                    too many. */}
                <div id="help-article">
                    <Article topic={topic} />
                </div>

                {related.length > 0 && (
                    <div className="mt-12 max-w-[68ch] border-t border-slate-200 pt-5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Next</p>
                        <ul className="mt-2 space-y-1.5">
                            {related.map((r) => (
                                <li key={r.slug}>
                                    <Link href={`/help/${r.slug}`} className="text-[14px] text-teal-700 underline-offset-4 hover:underline">
                                        {r.title}
                                    </Link>
                                    <span className="ml-2 text-[13px] text-slate-500">{r.question}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <aside className="hidden w-48 shrink-0 xl:block">
                <OnThisPage anchors={anchors} />
            </aside>
        </div>
    );
}
