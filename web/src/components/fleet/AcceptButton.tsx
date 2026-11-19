"use client";

import { Button } from "@/components/ui/button";
import { acceptAction } from "@/lib/fleet/actions";
import { Outcome, useAction } from "@/components/settings/council/shared";

/** Accept a vehicle sent here, from the board, without opening its job card. */
export function AcceptButton({ tenant, documentId, visitId }: { tenant: string; documentId: string; visitId: string }) {
    const [state, accept, pending] = useAction(() => acceptAction(tenant, documentId, visitId));
    return (
        <form action={accept} className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-7" disabled={pending}>{pending ? "Accepting…" : "Accept"}</Button>
            {!state.ok && <Outcome state={state} />}
        </form>
    );
}
