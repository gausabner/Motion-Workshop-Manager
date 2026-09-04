import { MechanicDashboard } from "@/components/pwa/MechanicDashboard";
import { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: "TechBay | MOTION",
    description: "Mechanic floor application for managing bays and digital inspections.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "TechBay",
    },
};

export const viewport: Viewport = {
    themeColor: "#020617", // slate-950
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Prevent zoom on mobile inputs
};

export default async function PWADashboardPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    return <MechanicDashboard tenant={resolvedParams.tenant} />;
}
