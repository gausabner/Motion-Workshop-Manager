"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteTemplateAction, duplicateTemplateAction, setTemplateActiveAction } from "@/lib/inspections/template-actions";

export function TemplateRowActions({ tenant, id, active, used }: { tenant: string; id: string; active: boolean; used: number }) {
    const [message, setMessage] = useState<string>();
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [pending, start] = useTransition();
    const run = (work: () => Promise<{ ok: boolean; message?: string } | void>) => start(async () => {
        setMessage(undefined);
        const result = await work();
        if (result && !result.ok) setMessage(result.message);
    });
    return (
        <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7" disabled={pending} onClick={() => run(() => duplicateTemplateAction(tenant, id))}>Duplicate</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7" disabled={pending} onClick={() => run(() => setTemplateActiveAction(tenant, id, !active))}>{active ? "Switch off" : "Switch on"}</Button>
                {used === 0 && (confirmDelete ? (
                    <>
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-red-700" disabled={pending} onClick={() => run(() => deleteTemplateAction(tenant, id))}>Delete it</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setConfirmDelete(false)}>Keep</Button>
                    </>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-400" onClick={() => setConfirmDelete(true)}>Delete</Button>
                ))}
            </div>
            {message && <p className="max-w-xs text-right text-xs text-red-600" role="alert">{message}</p>}
        </div>
    );
}
