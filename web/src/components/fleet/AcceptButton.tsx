"use client";

import { Button } from "@/components/ui/button";
import { acceptAction } from "@/lib/fleet/actions";
import { Outcome, useMove } from "@/components/settings/council/shared";

/** Accept a vehicle sent here, from the board, without opening its job card. */
export function AcceptButton({ tenant, documentId, visitId }: { tenant: string; documentId: string; visitId: string }) {
    const [state, accept, pending] = useMove(() => acceptAction(tenant, documentId, visitId));
    return (
        // Once accepted, say so here: the board's own refresh may come a moment later.
        state.ok ? (
            <p role="status" className="text-xs font-medium text-teal-700">Accepted</p>
        ) : (
            <form action={accept} className="flex items-center gap-2">
                <Button type="submit" size="sm" variant="outline" className="h-7 pointer-coarse:min-h-11" disabled={pending}>{pending ? "Accepting…" : "Accept"}</Button>
                <Outcome state={state} />
            </form>
        )
    );
}
