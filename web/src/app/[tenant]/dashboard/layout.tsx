import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function TenantDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardLayout>{children}</DashboardLayout>;
}
