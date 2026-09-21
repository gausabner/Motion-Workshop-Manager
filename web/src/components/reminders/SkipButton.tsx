"use client";

import { useTransition } from "react";
import type { ReminderKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { skipReminderAction, unskipReminderAction } from "@/lib/reminders/actions";

export function SkipButton({ tenant, reminder }: { tenant: string; reminder: { kind: ReminderKind; targetId: string; dueOn: string } }) {
    const [pending, start] = useTransition();
    return (
        <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-500" disabled={pending} onClick={() => start(() => skipReminderAction(tenant, reminder))}>
            {pending ? "…" : "Skip"}
        </Button>
    );
}

export function UnskipButton({ tenant, reminderId }: { tenant: string; reminderId: string }) {
    const [pending, start] = useTransition();
    return (
        <button type="button" className="text-xs font-medium text-teal-700 hover:underline disabled:opacity-50" disabled={pending} onClick={() => start(() => unskipReminderAction(tenant, reminderId))}>
            Put back
        </button>
    );
}
