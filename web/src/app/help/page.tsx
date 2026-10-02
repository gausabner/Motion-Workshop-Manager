import { IsoScene } from "@/components/public/iso/primitives";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoMotion } from "@/components/public/iso/IsoMotion";
import { ManualScene } from "@/components/public/iso/scenes";
import { PublicPage, PublicBar, PublicFoot, PublicButton } from "@/components/public/frame";
import { TopicFinder, type FinderGroup } from "@/components/help/TopicFinder";
import { byGroup, TOPICS } from "@/lib/help";
import { haystack } from "@/lib/help/content";

export const metadata = {
    title: "Help | MOTION Workshop Manager",
    description: "How to run a workshop on MOTION: the job, the money, the parts and the reports.",
};

/**
 * The way into the manual.
 *
 * The contents lead. Everything there is, set out in full, so nobody has to
 * already know the right word to ask for — and a finder above it for the
 * people who do.
 *
 * It sits outside `(library)`, the route group that holds the articles and
 * their reading shell. An article wants a sticky masthead and a rail of its
 * neighbours; this page wants the same chrome as pricing and support, because
 * somebody arriving from the front door should not feel they have crossed into
 * a different site to read the manual.
 *
 * The search text is built here rather than in the browser. `haystack` already
 * flattens a topic's blocks into one lower-cased string for the manual's own
 * search; reusing it means the two searches agree about what a topic says,
 * and it ships as data instead of as every article's full prose.
 */
export default function HelpIndex() {
    const groups: FinderGroup[] = byGroup().map((g) => ({
        id: g.id,
        label: g.label,
        topics: g.topics.map((t) => ({
            slug: t.slug,
            title: t.title,
            question: t.question,
            haystack: `${g.label} ${t.title} ${t.question} ${haystack(t)}`.toLowerCase().replace(/[‘’]/g, "'"),
        })),
    }));

    return (
        <PublicPage>
            <TopicFinder
                bar={<PublicBar current="/help" />}
                groups={groups}
                total={TOPICS.length}
                figure={
                    // Keyed, though it is a single element. This is a server
                    // component handed as a prop into a client one, which React
                    // serialises as a list — without a key it warns about a
                    // missing one, and the warning names a render method that
                    // has no list in it, which is a confusing half hour for
                    // whoever meets it next.
                    <IsoMotion key="help-figure" scope="header" tilt={10} drift={18}>
                        <IsoStage height={440} className="max-lg:h-[380px] max-md:h-[290px]" eager>
                            <IsoScene size={320} className="max-lg:[zoom:0.8] max-md:[zoom:0.72]">
                                <ManualScene />
                            </IsoScene>
                        </IsoStage>
                    </IsoMotion>
                }
            />
            <PublicFoot cta={<PublicButton href="/support" tone="onDark">Reach a person</PublicButton>} />
        </PublicPage>
    );
}
