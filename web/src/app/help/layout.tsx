import Link from "next/link";
import { BookOpen } from "lucide-react";
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
                        <Link href="/help" className="flex shrink-0 items-center gap-2 text-slate-900">
                            <BookOpen aria-hidden strokeWidth={1.75} className="h-[18px] w-[18px] text-slate-400" />
                            <span className="text-[14px] font-semibold tracking-tight">MOTION Help</span>
                        </Link>
                        {/* Desktop: search sits between the brand and the way
                            back in, reachable from every page of the manual. */}
                        <div className="hidden min-w-0 flex-1 justify-center md:flex">
                            <div className="w-full max-w-sm">
                                <HelpSearch />
                            </div>
                        </div>
                        <Link href="/login" className="shrink-0 text-[13px] text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">
                            Sign in
                        </Link>
                    </div>
                    {/* Phone: its own row rather than a cramped third of one. */}
                    <div className="pb-3 md:hidden">
                        <HelpSearch />
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-6xl lg:flex lg:gap-10 lg:px-4">
                <aside className="lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:w-56 lg:shrink-0 lg:overflow-y-auto lg:py-9">
                    <TopicRail groups={groups} />
                </aside>
                <main className="min-w-0 flex-1 px-4 py-9 lg:px-0">{children}</main>
            </div>
        </div>
    );
}
