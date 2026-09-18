import { DiaryView, type DiaryMode } from "@/components/diary/DiaryView";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getDiary } from "@/lib/diary/queries";
import { addDays, daysInMonth, startOfMonth, startOfWeek, toZoned } from "@/lib/diary/time";

export const metadata = { title: "Booking diary | MOTION Workshop Manager" };

const MODES: DiaryMode[] = ["day", "week", "month"];

export default async function DiaryPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ view?: string; date?: string; page?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);

    // "Today" and "now" are the workshop's, not the server's.
    const now = toZoned(new Date(), tenant.timezone);
    const mode = (MODES as string[]).includes(sp.view ?? "") ? (sp.view as DiaryMode) : "day";
    const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : now.day;

    let from = anchor;
    let to = anchor;
    if (mode === "week") {
        from = startOfWeek(anchor);
        to = addDays(from, 6);
    } else if (mode === "month") {
        // Whole weeks, so the grid has no holes at either end.
        const first = startOfMonth(anchor);
        from = startOfWeek(first);
        to = addDays(startOfWeek(addDays(first, daysInMonth(first) - 1)), 6);
    }

    const diary = await getDiary(db, tenant, from, to);

    return (
        <DiaryView
            tenant={slug}
            diary={diary}
            mode={mode}
            anchor={anchor}
            today={now.day}
            nowMinute={now.minute}
            page={Math.max(0, Number(sp.page) || 0)}
            canEdit={can(membership, "documents:write")}
            canManageHours={can(membership, "documents:write")}
        />
    );
}
