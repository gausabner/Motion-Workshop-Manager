"use client";

import { useState, useTransition } from "react";
import { revokeShareLinkAction } from "@/lib/messaging/actions";

/** Two clicks, because it stops a customer opening a document they were sent. */
export function RevokeLinkButton({ tenant, shareLinkId }: { tenant: string; shareLinkId: string }) {
    const [confirming, setConfirming] = useState(false);
    const [pending, start] = useTransition();

    if (!confirming) {
        return (
            <button type="button" onClick={() => setConfirming(true)} className="text-[11px] text-slate-400 hover:text-red-700">
                Withdraw link
            </button>
        );
    }
    return (
        <span className="inline-flex items-center gap-2 text-[11px]">
            <button
                type="button" disabled={pending}
                onClick={() => start(async () => { await revokeShareLinkAction(tenant, shareLinkId); setConfirming(false); })}
                className="font-medium text-red-700 hover:underline disabled:opacity-60"
            >
                {pending ? "Withdrawing…" : "Confirm — it will stop opening"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
        </span>
    );
}
