"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Bell, Building2, Car, CarFront, CalendarDays, ClipboardList, FileBarChart, LayoutDashboard,
    ListChecks, Megaphone, Package, Receipt, Settings, Timer, TrendingUp, Truck,
    Users, Wallet, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The sidebar, in five groups rather than twenty flat links.
 *
 * The old list ran Dashboard → Team in one column with no grouping and no
 * indication of where you were standing. Both matter more here than in most
 * products: a service advisor is interrupted constantly — a customer at the
 * counter, a phone in the other hand — and loses their place a dozen times a
 * day. Grouping gives them somewhere to look; the active marker tells them
 * where they already are.
 *
 * The groups follow the working day rather than the data model: what is
 * happening today, the work itself, the money, the parts, and the things you
 * set up once. "Transactions" sits under Work rather than Money because a
 * service advisor reaches for it to find a job, not to count takings.
 */

type Item = { href: string; label: string; icon: LucideIcon; show?: boolean };
type Group = { label: string; items: Item[] };

export function SidebarNav({
    base,
    reports,
    cost,
    manages,
}: {
    base: string;
    reports: boolean;
    cost: boolean;
    manages: boolean;
}) {
    const pathname = usePathname();

    const groups: Group[] = [
        {
            label: "Today",
            items: [
                { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
                { href: `${base}/dashboard/schedule`, label: "Booking diary", icon: CalendarDays },
                { href: `${base}/dashboard/reminders`, label: "Reminders", icon: Bell },
                { href: `${base}/dashboard/messages`, label: "Messages", icon: Megaphone },
            ],
        },
        {
            label: "Work",
            items: [
                { href: `${base}/dashboard/jobs`, label: "Jobs", icon: ClipboardList },
                { href: `${base}/dashboard/transactions`, label: "Transactions", icon: ListChecks },
                { href: `${base}/dashboard/customers`, label: "Customers", icon: Users },
                { href: `${base}/dashboard/vehicles`, label: "Vehicles", icon: Car },
                { href: `${base}/dashboard/loan-cars`, label: "Courtesy cars", icon: CarFront },
            ],
        },
        {
            label: "Money",
            items: [
                { href: `${base}/dashboard/payments`, label: "Receipts", icon: Wallet },
                { href: `${base}/dashboard/reports/receivables`, label: "Who owes us", icon: Receipt, show: reports },
                { href: `${base}/dashboard/reports/margin`, label: "Profit", icon: TrendingUp, show: reports },
                { href: `${base}/dashboard/reports/labour`, label: "Mechanic time", icon: Timer, show: reports },
                { href: `${base}/dashboard/reports`, label: "All reports", icon: FileBarChart, show: reports },
            ],
        },
        {
            label: "Parts & buying",
            items: [
                { href: `${base}/dashboard/products`, label: "Products", icon: Package, show: cost },
                { href: `${base}/dashboard/purchasing`, label: "Buying", icon: Truck, show: cost },
                { href: `${base}/dashboard/suppliers`, label: "Suppliers", icon: Building2, show: cost },
            ],
        },
        {
            label: "Setup",
            items: [
                { href: `${base}/dashboard/settings`, label: "Settings", icon: Settings },
                { href: `${base}/dashboard/settings/users`, label: "Team", icon: Wrench, show: manages },
            ],
        },
    ];

    const visible = groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.show !== false) }))
        .filter((g) => g.items.length > 0);

    // Longest matching href wins, so /settings/users marks Team rather than
    // Settings, and /jobs does not light up Dashboard. Prefix matching alone
    // gets both of those wrong.
    const active = visible
        .flatMap((g) => g.items)
        .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return (
        <nav className="grid items-start gap-px px-2 text-[11px] font-medium">
            {visible.map((group) => (
                <div key={group.label} className="pb-1">
                    <p className="px-3 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {group.label}
                    </p>
                    {group.items.map((item) => {
                        const isActive = item.href === active;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? "page" : undefined}
                                className={
                                    isActive
                                        ? "flex items-center gap-3 rounded-lg border-l-2 border-teal-600 bg-teal-50 py-2 pl-[10px] pr-3 font-semibold text-teal-900 transition-all"
                                        : "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 focus-visible:bg-slate-100 focus-visible:text-slate-900"
                                }
                            >
                                <Icon className="h-[12px] w-[12px] shrink-0" aria-hidden="true" />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </nav>
    );
}
