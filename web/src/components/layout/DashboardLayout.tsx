import Link from "next/link";
import { Search, Bell, LogOut } from "lucide-react";
import type { UserGroup } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { logoutAction } from "@/lib/auth/actions";
import { can } from "@/lib/auth/permissions";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { SiteSwitcher } from "@/components/layout/SiteSwitcher";
import { HelpButton } from "@/components/help/HelpButton";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { MobileNav } from "@/components/layout/MobileNav";

export type ShellProps = {
    tenant: string;
    workshopName: string;
    userName: string;
    group: UserGroup;
    /** Every site this person may open. One entry is the ordinary case. */
    sites: { slug: string; name: string }[];
};

export function Sidebar({ tenant, workshopName, group, sites }: ShellProps) {
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
                <Link href={`/${tenant}/dashboard/reports`} className="hidden md:block">
                    <Button variant="outline" className="h-9 px-4 text-sm font-medium border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                        Reports
                    </Button>
                </Link>
                <form action={`/${tenant}/dashboard/customers`} method="get" className="min-w-0 flex-1 sm:w-initial sm:flex-none">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="search"
                            name="q"
                            placeholder="Search customers…"
                            className="w-full min-w-0 rounded-full border-none bg-slate-100 pl-10 pr-4 py-2 text-base outline-none focus:ring-2 focus:ring-teal-500/50 sm:w-[300px] sm:text-sm md:w-[200px] lg:w-[350px]"
                        />
                    </div>
                </form>
            </div>
            {/* Beside the work, not in a menu: help that takes three clicks
                to reach is help nobody reaches. */}
            <HelpButton />
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
                <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 border-slate-200 sm:border-l sm:pl-4">
                <div className="hidden text-right leading-tight sm:block">
                    <p className="text-sm font-medium text-slate-800">{userName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">{GROUP_LABELS[group]}</p>
                </div>
                <form action={logoutAction}>
                    <Button type="submit" variant="ghost" size="icon" className="rounded-full" aria-label="Sign out" title="Sign out">
                        <LogOut className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </header>
    );
}

export function DashboardLayout({ children, ...shell }: ShellProps & { children: React.ReactNode }) {
    const base = `/${shell.tenant}`;
    return (
        <div className="flex h-dvh w-full overflow-hidden bg-slate-100">
            <Sidebar {...shell} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav {...shell} />
                {/* `overscroll-contain` stops a list that has hit its end from
                    dragging the page behind it, which on a phone reads as the
                    whole app coming loose. The bottom padding clears the tab
                    bar and the home indicator, so the last row of a long list
                    is reachable rather than sitting under the navigation. */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pb-[calc(64px+env(safe-area-inset-bottom,0px))] sm:p-6 md:pb-6">
                    {children}
                </main>
            </div>
            <MobileNav
                base={base}
                workshopName={shell.workshopName}
                reports={can({ group: shell.group }, "reports:view")}
                cost={can({ group: shell.group }, "documents:see_cost")}
                manages={can({ group: shell.group }, "users:manage")}
            />
        </div>
    );
}
