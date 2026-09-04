import Link from "next/link";
import { CalendarDays, Settings, Users, LayoutDashboard, Search, Bell, Shield, Wrench, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";

function MotionLogo({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 110 28" className={className} xmlns="http://www.w3.org/2000/svg">
            <text
                x="0"
                y="22"
                fill="currentColor"
                className="font-bold text-2xl tracking-tight"
                style={{ fontFamily: 'inherit' }}
            >
                motion
            </text>
            <path
                d="M 82 8 L 94 8 L 94 20 M 94 8 L 82 20"
                stroke="#0d9488"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </svg>
    );
}

export function Sidebar() {
    // TODO: Replace with real auth check context
    const isAdmin = true;

    return (
        <div className="flex h-screen w-[180px] flex-col border-r bg-slate-50">
            <div className="flex h-14 items-center border-b px-4">
                <Link href="/" className="flex items-center gap-2 font-semibold text-slate-800">
                    <MotionLogo className="h-[22px] w-auto" />
                </Link>
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-[10px] font-medium">
                    <Link href="/demo-tenant/dashboard" className="flex items-center gap-3 rounded-lg bg-teal-50 px-3 py-2 text-teal-700 transition-all">
                        <LayoutDashboard className="h-[11px] w-[11px]" />
                        Dashboard
                    </Link>
                    <Link href="/demo-tenant/dashboard/schedule" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                        <CalendarDays className="h-[11px] w-[11px]" />
                        Schedule
                    </Link>
                    <Link href="/demo-tenant/dashboard/customers" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                        <Users className="h-[11px] w-[11px]" />
                        Customers
                    </Link>
                    <Link href="/demo-tenant/dashboard/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                        <Settings className="h-[11px] w-[11px]" />
                        Settings
                    </Link>
                    {isAdmin && (
                        <div className="mt-6">
                            <h4 className="px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Admin</h4>
                            <div className="space-y-1">
                                <Link href="/demo-tenant/admin/mechanics" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                                    <Wrench className="h-[11px] w-[11px]" />
                                    Mechanics
                                </Link>
                                <Link href="/demo-tenant/admin/service-advisors" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                                    <Headphones className="h-[11px] w-[11px]" />
                                    Service Advisors
                                </Link>
                                <Link href="/demo-tenant/admin/users" className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900">
                                    <Users className="h-[11px] w-[11px]" />
                                    Users
                                </Link>
                            </div>
                        </div>
                    )}
                </nav>
            </div>
        </div>
    );
}

export function TopNav() {
    return (
        <header className="flex h-14 shrink-0 items-center gap-4 border-b bg-white px-6 lg:h-[60px]">
            <div className="flex flex-1 items-center gap-4 justify-end">
                <Link href="/demo-tenant/dashboard/reports">
                    <Button
                        variant="outline"
                        className="h-9 px-4 text-sm font-medium border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    >
                        Reports
                    </Button>
                </Link>
                <form className="w-full sm:w-initial">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="search"
                            placeholder="Search bookings, invoices..."
                            className="w-full rounded-full border-none bg-slate-100 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/50 sm:w-[300px] md:w-[200px] lg:w-[350px]"
                        />
                    </div>
                </form>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
                <Bell className="h-5 w-5" />
                <span className="sr-only">Toggle notifications</span>
            </Button>
        </header>
    );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden w-full bg-slate-100">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopNav />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
