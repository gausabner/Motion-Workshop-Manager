"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { removeTenderProof, uploadTenderProof } from "@/lib/attachments/actions";
import { ALLOWED_TYPE_LABEL, MAX_UPLOAD_BYTES, uploadError } from "@/lib/storage/keys";

export type Proof = { id: string; fileName: string } | null;

/**
 * The EFT slip, attached to the tender it proves.
 *
 * The file is uploaded on its own the moment it is chosen, rather than riding
 * on the form submit — a receipt gets saved several times while the counter
 * works, and re-posting a 10 MB PDF each time would be absurd. That is also
 * why the tender has to exist first: the file needs a row to belong to.
 */
export function TenderProof({ tenant, tenderId, proof, onChange, disabled }: {
    tenant: string;
    tenderId?: string;
    proof: Proof;
    onChange: (proof: Proof) => void;
    disabled?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, start] = useTransition();
    const [error, setError] = useState<string>();

    if (!tenderId) {
        return <p className="text-[11px] text-slate-400">Save the receipt, then attach the proof of payment here.</p>;
    }

    function choose(file: File) {
        setError(undefined);
        const problem = uploadError({ size: file.size, type: file.type, name: file.name });
        if (problem) {
            setError(problem);
            return;
        }
        start(async () => {
            const body = new FormData();
            body.set("file", file);
            const result = await uploadTenderProof(tenant, tenderId!, body);
            if (result.ok) onChange({ id: result.attachmentId, fileName: file.name });
            else setError(result.message);
        });
    }

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
            {proof ? (
                <>
                    <a
                        href={`/${tenant}/attachments/${proof.id}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                    >
                        <Paperclip className="w-3 h-3" />{proof.fileName}
                    </a>
                    {!disabled && (
                        <button
                            type="button" className="text-slate-400 hover:text-red-600" aria-label="Remove proof of payment"
                            onClick={() => start(async () => {
                                await removeTenderProof(tenant, tenderId!);
                                onChange(null);
                            })}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </>
            ) : disabled ? (
                <span className="text-slate-400">No proof of payment attached.</span>
            ) : (
                <>
                    <input
                        ref={input} type="file" className="hidden"
                        accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) choose(file);
                            e.target.value = "";
                        }}
                    />
                    <button
                        type="button" disabled={pending} onClick={() => input.current?.click()}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-teal-700 disabled:opacity-60"
                    >
                        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                        {pending ? "Uploading…" : "Attach proof of payment"}
                    </button>
                    <span className="text-slate-400">{ALLOWED_TYPE_LABEL}, up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB</span>
                </>
            )}
            {error && <span className="text-red-600" role="alert">{error}</span>}
        </div>
    );
}
