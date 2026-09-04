import { redirect } from "next/navigation";

export default async function SettingsIndexPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;
    // Redirect to the first meaningful settings page 
    redirect(`/${resolvedParams.tenant}/dashboard/settings/company`);
}
