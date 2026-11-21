import Link from "next/link";
import { Search } from "lucide-react";
import type { UserGroup } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { can } from "@/lib/auth/permissions";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { SiteSwitcher } from "@/components/layout/SiteSwitcher";
import { HelpButton } from "@/components/help/HelpButton";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { ConfirmProvider } from "@/components/ui/confirm";
import type { Feature } from "@/lib/plans/features";

export type ShellProps = {
    tenant: string;
    workshopName: string;
    userName: string;
    group: UserGroup;
    /** Every site this person may open. One entry is the ordinary case. */
    sites: { slug: string; name: string }[];
    /** What the workshop's plan includes — the navigation offers nothing else. */
    features: Feature[];
};

export function Sidebar({ tenant, workshopName, group, sites, features }: ShellProps) {
    const base = `/${tenant}`;
    return (
        <div className="hidden h-dvh w-[180px] shrink-0 flex-col border-r bg-slate-50 md:flex">
            <div className="flex h-14 items-center border-b px-4">
                <Link href={`${base}/dashboard`} className="flex items-center gap-2 font-semibold text-slate-800">
                    <MotionLogo className="h-[22px] w-auto" />
                </Link>
            </div>
            <SiteSwitcher current={tenant} sites={sites.length > 0 ? sites : [{ slug: tenant, name: workshopName }]} />
            <div className="flex-1 overflow-auto py-1">
                <SidebarNav
                    base={base}
                    reports={can({ group }, "reports:view")}
                    cost={can({ group }, "documents:see_cost")}
                    manages={can({ group }, "users:manage")}
                    features={features}
                />
            </div>
        </div>
    );
}

export function TopNav({ tenant, userName, group }: ShellProps) {
    return (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 pt-[env(safe-area-inset-top,0px)] sm:gap-4 sm:px-6 lg:h-[60px]">
            {/* The sidebar carries the logo on desktop; below that breakpoint it
                is hidden, so the header has to. */}
            <Link href={`/${tenant}/dashboard`} className="shrink-0 md:hidden" aria-label="Dashboard">
                <MotionLogo className="h-[20px] w-auto" />
            </Link>
            <div className="flex flex-1 items-center gap-4 justify-end">
                <Button asChild variant="outline" className="hidden h-9 px-4 text-sm font-medium border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 md:inline-flex">
                    <Link href={`/${tenant}/dashboard/reports`}>Reports</Link>
                </Button>
                <form role="search" action={`/${tenant}/dashboard/customers`} method="get" className="min-w-0 flex-1 sm:w-initial sm:flex-none">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" aria-hidden="true" />
                        <input
                            type="search"
                            name="q"
                            aria-label="Search customers"
                            placeholder="Search customers…"
                            className="w-full min-w-0 rounded-full border-none bg-slate-100 pl-10 pr-4 py-2 text-base outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-teal-700 sm:w-[300px] sm:text-sm md:w-[200px] lg:w-[350px]"
                        />
                    </div>
                </form>
            </div>
            {/* Beside the work, not in a menu: help that takes three clicks
                to reach is help nobody reaches. */}
            <HelpButton />
            <div className="flex items-center gap-3 border-slate-200 sm:border-l sm:pl-4">
                <div className="hidden text-right leading-tight sm:block">
                    <p className="text-sm font-medium text-slate-800">{userName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{GROUP_LABELS[group]}</p>
                </div>
                <SignOutButton />
            </div>
        </header>
    );
}

export function DashboardLayout({ children, ...shell }: ShellProps & { children: React.ReactNode }) {
    const base = `/${shell.tenant}`;
    return (
        <ConfirmProvider>
        <div className="flex h-dvh w-full overflow-hidden bg-background">
            {/* First in the tab order, so a keyboard reaches the work without
                passing the thirty links of the navigation first. */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:border focus:border-slate-200 focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-teal-700 focus:shadow-[0_10px_15px_-3px_rgb(15_23_42/0.05),0_4px_6px_-4px_rgb(15_23_42/0.05)]"
            >
                Skip to content
            </a>
            <Sidebar {...shell} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav {...shell} />
                {/* `overscroll-contain` stops a list that has hit its end from
                    dragging the page behind it, which on a phone reads as the
                    whole app coming loose. The bottom padding clears the tab
                    bar and the home indicator, so the last row of a long list
                    is reachable rather than sitting under the navigation. */}
                <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pb-[calc(64px+env(safe-area-inset-bottom,0px))] outline-none sm:p-6 md:pb-6">
                    {children}
                </main>
            </div>
            <MobileNav
                base={base}
                workshopName={shell.workshopName}
                reports={can({ group: shell.group }, "reports:view")}
                cost={can({ group: shell.group }, "documents:see_cost")}
                manages={can({ group: shell.group }, "users:manage")}
                features={shell.features}
            />
        </div>
        </ConfirmProvider>
    );
}
