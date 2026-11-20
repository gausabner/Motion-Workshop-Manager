"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outcome } from "@/components/settings/council/shared";
import { raiseAction, raiseForJobAction } from "@/lib/requisitions/actions";
import type { RequisitionAnswer } from "@/lib/requisitions/view";

/** Start a requisition, and go straight to it. From a job card it is charged to the job; from the list, to a vote chosen next. A purchase requisition is for what stores does not keep. */
export function RaiseButton({ tenant, documentId, label = "New requisition", kind = "STORES", quiet = false }: { tenant: string; documentId?: string; label?: string; kind?: "STORES" | "PURCHASE"; quiet?: boolean }) {
    const [state, raise, pending] = useActionState(() => (documentId ? raiseForJobAction(tenant, documentId) : raiseAction(tenant, kind)), {} as RequisitionAnswer);
    return (
        <form action={raise} className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" variant={quiet ? "outline" : "default"} className={`h-9 pointer-coarse:min-h-11 ${quiet ? "" : "bg-teal-700 hover:bg-teal-800"}`} disabled={pending}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />{pending ? "Opening…" : label}
            </Button>
            <Outcome state={state} />
        </form>
    );
}
