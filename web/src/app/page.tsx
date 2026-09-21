import { redirect } from "next/navigation";
import { getSessionUser, defaultTenantSlug } from "@/lib/auth/session";

export default async function Home() {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    const slug = await defaultTenantSlug(user.id);
    redirect(slug ? `/${slug}/dashboard` : "/register");
}
