import Link from "next/link";
import { CalendarDays, Settings, Users, LayoutDashboard, Search, Bell, Wrench, Headphones, Car, LogOut, ClipboardList, ListChecks, Wallet } from "lucide-react";
import type { UserGroup } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { logoutAction } from "@/lib/auth/actions";
import { can } from "@/lib/auth/permissions";
import { GROUP_LABELS } from "@/lib/auth/permissions";

export type ShellProps = {
    tenant: string;
    workshopName: string;
    userName: string;
    group: UserGroup;
};

const linkBase = "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900";

export function Sidebar({ tenant, workshopName, group }: ShellProps) {
    const base = `/${tenant}`;
    const manages = can({ group }, "users:manage");
    return (
        <div className="flex h-screen w-[180px] flex-col border-r bg-slate-50">
            <div className="flex h-14 items-center border-b px-4">
                <Link href={`${base}/dashboard`} className="flex items-center gap-2 font-semibold text-slate-800">
                    <MotionLogo className="h-[22px] w-auto" />
                </Link>
            </div>
            <div className="px-4 py-2 border-b">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Workshop</p>
                <p className="text-xs font-semibold text-slate-700 truncate" title={workshopName}>{workshopName}</p>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-[11px] font-medium">
                    <Link href={`${base}/dashboard`} className={linkBase}><LayoutDashboard className="h-[12px] w-[12px]" />Dashboard</Link>
                    <Link href={`${base}/dashboard/schedule`} className={linkBase}><CalendarDays className="h-[12px] w-[12px]" />Booking Diary</Link>
                    <Link href={`${base}/dashboard/transactions`} className={linkBase}><ListChecks className="h-[12px] w-[12px]" />Transactions</Link>
                    <Link href={`${base}/dashboard/jobs`} className={linkBase}><ClipboardList className="h-[12px] w-[12px]" />Jobs</Link>
                    <Link href={`${base}/dashboard/payments`} className={linkBase}><Wallet className="h-[12px] w-[12px]" />Receipts</Link>
                    <Link href={`${base}/dashboard/customers`} className={linkBase}><Users className="h-[12px] w-[12px]" />Customers</Link>
                    <Link href={`${base}/dashboard/vehicles`} className={linkBase}><Car className="h-[12px] w-[12px]" />Vehicles</Link>
                    <Link href={`${base}/dashboard/settings`} className={linkBase}><Settings className="h-[12px] w-[12px]" />Settings</Link>
                    {manages && (
                        <div className="mt-6">
                            <h4 className="px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Admin</h4>
                            <div className="space-y-1">
                                <Link href={`${base}/admin/mechanics`} className={linkBase}><Wrench className="h-[12px] w-[12px]" />Mechanics</Link>
                                <Link href={`${base}/admin/service-advisors`} className={linkBase}><Headphones className="h-[12px] w-[12px]" />Service Advisors</Link>
                                <Link href={`${base}/admin/users`} className={linkBase}><Users className="h-[12px] w-[12px]" />Users</Link>
                            </div>
                        </div>
                    )}
                </nav>
            </div>
        </div>
    );
}

export function TopNav({ tenant, userName, group }: ShellProps) {
    return (
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-6 lg:h-[60px]">
            <div className="flex flex-1 items-center gap-4 justify-end">
                <Link href={`/${tenant}/dashboard/reports`}>
                    <Button variant="outline" className="h-9 px-4 text-sm font-medium border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                        Reports
                    </Button>
                </Link>
                <form action={`/${tenant}/dashboard/customers`} method="get" className="w-full sm:w-initial">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="search"
                            name="q"
                            placeholder="Search customers…"
                            className="w-full rounded-full border-none bg-slate-100 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/50 sm:w-[300px] md:w-[200px] lg:w-[350px]"
                        />
                    </div>
                </form>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Notifications">
                <Bell className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
                <div className="text-right leading-tight">
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
    return (
        <div className="flex h-screen overflow-hidden w-full bg-slate-100">
            <Sidebar {...shell} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav {...shell} />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}
