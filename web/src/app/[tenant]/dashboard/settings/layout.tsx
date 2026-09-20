import Link from "next/link";
import { Building2, FileText, Users, MessageSquare, Calendar, Globe, ClipboardCheck, Tags, Upload } from "lucide-react";

const sidebarNavItems = [
    {
        title: "Company Settings",
        href: "company",
        icon: <Building2 className="w-4 h-4 mr-2" />,
    },
    {
        title: "Tax & Financials",
        href: "tax",
        icon: <FileText className="w-4 h-4 mr-2" />,
    },
    {
        title: "Bookings",
        href: "booking",
        icon: <Calendar className="w-4 h-4 mr-2" />,
    },
    {
        title: "Messaging & Reminders",
        href: "messaging",
        icon: <MessageSquare className="w-4 h-4 mr-2" />,
    },
    {
        title: "Pricing",
        href: "pricing",
        icon: <Tags className="w-4 h-4 mr-2" />,
    },
    {
        title: "Inspections",
        href: "inspections",
        icon: <ClipboardCheck className="w-4 h-4 mr-2" />,
    },
    {
        title: "Customer portal",
        href: "portal",
        icon: <Globe className="w-4 h-4 mr-2" />,
    },
    {
        title: "Import",
        href: "import",
        icon: <Upload className="w-4 h-4 mr-2" />,
    },
    {
        title: "Team",
        href: "users",
        icon: <Users className="w-4 h-4 mr-2" />,
    },
];

export default async function SettingsLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;
    const basePath = `/${resolvedParams.tenant}/dashboard/settings`;

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground text-slate-500">
                    Manage your workshop configurations, tax profiles, and user roles.
                </p>
            </div>
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="lg:w-1/5">
                    <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
                        {sidebarNavItems.map((item) => (
                            <div key={item.href} className="flex flex-col">
                                <Link
                                    href={`${basePath}/${item.href}`}
                                    className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-slate-100/50 hover:text-slate-900 transparent text-slate-600 transition-colors"
                                >
                                    {item.icon}
                                    {item.title}
                                </Link>
                            </div>
                        ))}
                    </nav>
                </aside>
                <div className="flex-1 lg:max-w-4xl">{children}</div>
            </div>
        </div>
    );
}
