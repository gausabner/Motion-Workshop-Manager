import { redirect } from "next/navigation";

/** Mechanics, advisors and users are one team now, managed in settings. Old links land there. */
export default async function AdminRedirect({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant } = await params;
    redirect(`/${tenant}/dashboard/settings/users`);
}
