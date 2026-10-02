import { IsoScene } from "@/components/public/iso/primitives";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoMotion } from "@/components/public/iso/IsoMotion";
import { HeroScene } from "@/components/public/iso/scenes";

/**
 * The column beside a sign-in form.
 *
 * The same object as the landing hero, deliberately: somebody signing in on a
 * Monday saw it on the page that sold them the product, and meeting it again
 * is what makes the two feel like one piece of software rather than a
 * marketing site and then an application.
 *
 * **The pointer is tracked across the whole window**, which is the one thing
 * about this that is not obvious. Somebody filling in a sign-in form never
 * moves the cursor over the artwork — they go email, password, button, all in
 * the left column — so a scene that only answers a pointer passing over
 * *itself* would sit dead for the entire visit. Tracking the window means it
 * answers the person typing, which is the only person here.
 *
 * `aria-hidden`, and nothing in it is reachable by keyboard. It is a picture.
 */
export function AuthArt() {
    return (
        <aside
            aria-hidden
            className="relative hidden overflow-hidden border-l border-slate-200 bg-slate-100 md:block"
        >
            {/* The ribbon arriving from off-screen and leaving again — the same
                line the landing page draws down its spine, caught mid-journey.
                `preserveAspectRatio="none"` because it is a gesture across
                whatever shape this column happens to be, not a figure. */}
            <svg
                aria-hidden
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
            >
                <path
                    d="M0 18 C 30 18, 22 60, 50 62 S 80 92, 100 96"
                    fill="none"
                    stroke="rgba(13,148,136,0.12)"
                    strokeWidth={20}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                />
                <path
                    d="M0 18 C 30 18, 22 60, 50 62 S 80 92, 100 96"
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeOpacity={0.55}
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            <IsoMotion scope="window" tilt={10} drift={18} className="absolute inset-0">
                <IsoStage fill className="absolute inset-0" eager>
                    <IsoScene size={380} top="50%" className="max-lg:[zoom:0.72]">
                        <HeroScene />
                    </IsoScene>
                </IsoStage>
            </IsoMotion>
        </aside>
    );
}
