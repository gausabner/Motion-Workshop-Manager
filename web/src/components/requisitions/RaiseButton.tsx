"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outcome } from "@/components/settings/council/shared";
import { raiseAction, raiseForJobAction } from "@/lib/requisitions/actions";
import type { RequisitionAnswer } from "@/lib/requisitions/view";

/** Start a requisition, and go straight to it. From a job card it is charged to the job; from the list, to a vote chosen next. */
export function RaiseButton({ tenant, documentId, label = "New requisition" }: { tenant: string; documentId?: string; label?: string }) {
    const [state, raise, pending] = useActionState(() => (documentId ? raiseForJobAction(tenant, documentId) : raiseAction(tenant)), {} as RequisitionAnswer);
    return (
        <form action={raise} className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800 pointer-coarse:min-h-11" disabled={pending}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />{pending ? "Opening…" : label}
            </Button>
            <Outcome state={state} />
        </form>
    );
}
