import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { byGroup } from "@/lib/help";
import { HelpSearch } from "@/components/help/HelpSearch";
import { TopicRail } from "@/components/help/TopicRail";

export const metadata = {
    title: "Help | MOTION Workshop Manager",
    description: "How to run a workshop on MOTION: the job, the money, the parts and the reports.",
};

/**
 * The manual's shell: a rail that is always there, and a masthead that is not
 * a marketing header. Somebody arriving here has a question, not an interest
 * in the product.
 */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
    const groups = byGroup();
    return (
        <div className="min-h-dvh bg-white">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
                <div className="mx-auto max-w-6xl px-4">
                    <div className="flex h-14 items-center justify-between gap-4">
                        {/* The mark rather than the words "MOTION Help": the
                            manual keeps its own light reading world, which was
                            settled against its direction contract, but the
                            brand should be the same object here as everywhere
                            else. */}
                        <Link href="/help" className="flex shrink-0 items-center gap-2.5 text-slate-900">
                            <MotionLogo className="h-[18px] w-auto" />
                            <span className="hidden text-[13px] text-slate-400 sm:inline">Help</span>
                        </Link>
                        {/* Desktop: search sits between the brand and the way
                            back in, reachable from every page of the manual. */}
                        <div className="hidden min-w-0 flex-1 justify-center md:flex">
                            <div className="w-full max-w-sm">
                                <HelpSearch />
                            </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-4">
                            <Link
                                href="/"
                                className="group hidden items-center gap-1.5 text-[13px] text-slate-500 underline-offset-4 hover:text-slate-900 sm:inline-flex"
                            >
                                <ArrowLeft
                                    className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5"
                                    strokeWidth={2}
                                />
                                Site
                            </Link>
                            <Link href="/login" className="rounded-full bg-slate-900 px-3.5 py-1.5 text-[13px] font-medium text-white motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-700">
                                Sign in
                            </Link>
                        </span>
                    </div>
                    {/* Phone: its own row rather than a cramped third of one. */}
                    <div className="pb-3 md:hidden">
                        <HelpSearch />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl lg:flex lg:gap-10 lg:px-4">
                {/* The fade is the cue that the list continues. A seventeen-item
                    rail overflows on a short laptop screen and had no edge at
                    all, so it read as ending wherever it was cut. Masked rather
                    than drawn, so nothing new is introduced to the palette; on
                    a tall screen the list ends above it and it is invisible. */}
                <aside
                    className="lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-56 lg:shrink-0 lg:overflow-y-auto lg:py-9 lg:[mask-image:linear-gradient(to_bottom,#000_calc(100%-2.5rem),transparent)]"
                >
                    <TopicRail groups={groups} />
                </aside>
                <main className="page-in min-w-0 flex-1 px-4 py-9 lg:px-0">{children}</main>
            </div>
        </div>
    );
}
