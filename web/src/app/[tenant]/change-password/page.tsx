import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm";

export const metadata = { title: "Choose a password | MOTION Workshop Manager" };

/**
 * The only screen an account can reach while its password was set by somebody
 * else.
 *
 * Deliberately outside the dashboard: `requireTenant` sends people here, so a
 * page that used it would send itself here for ever. It also has no sidebar and
 * no tab bar, because there is nowhere else to go until this is done.
 */
export default async function ChangePasswordPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const user = await requireUser(`/${slug}/change-password`);
    // Reachable on purpose by anyone who simply wants to change their own
    // password, so there is no redirect away when nothing is being forced.
    const forced = user.mustChangePassword;

    return (
        <main className="grid min-h-svh place-items-center bg-slate-100 p-6">
            <ChangePasswordForm tenant={slug} forced={forced} name={user.firstName} />
        </main>
    );
}
