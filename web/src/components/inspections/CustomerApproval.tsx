"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { answerFinding, sendComment } from "@/lib/inspections/public-actions";
import { money } from "@/lib/format";

type Finding = {
    id: string;
    group: string;
    description: string;
    comment: string | null;
    urgent: boolean;
    soon: boolean;
    estimate: number | null;
    readings: { label: string; value: string }[];
    photos: string[];
    answer: "approve" | "decline" | null;
    locked: boolean;
};

type Props = {
    token: string;
    workshop: { name: string; phone: string | null };
    vehicle: string;
    findings: Finding[];
    fine: { group: string; description: string }[];
    currency: string;
    closed: boolean;
};

/**
 * What the customer sees on their phone (R5): each finding that needs a
 * decision, with the mechanic's words, the photos and the price, and a yes or
 * no on each one — not one button for the whole report. Answers save as they
 * are tapped, and can be changed until the work is on the job card.
 */
export function CustomerApproval({ token, workshop, vehicle, findings: initial, fine, currency, closed }: Props) {
    const [findings, setFindings] = useState(initial);
    const [error, setError] = useState<string>();
    const [pending, start] = useTransition();
    const [comment, setComment] = useState("");
    const [sent, setSent] = useState(false);
    const [zoom, setZoom] = useState<string | null>(null);

    const total = (pick: (f: Finding) => boolean) => findings.filter(pick).reduce((t, f) => t + (f.estimate ?? 0), 0);
    const approved = total((f) => f.answer === "approve");
    const waiting = findings.filter((f) => !f.answer).length;

    function answer(f: Finding, next: "approve" | "decline") {
        const value = f.answer === next ? "clear" : next;
        const before = findings;
        setFindings(findings.map((x) => (x.id === f.id ? { ...x, answer: value === "clear" ? null : value } : x)));
        setError(undefined);
        start(async () => {
            const result = await answerFinding(token, f.id, value);
            if (!result.ok) {
                setFindings(before);
                setError(result.message);
            } else if (result.booked) {
                setFindings((all) => all.map((x) => (x.id === f.id ? { ...x, locked: true } : x)));
            }
        });
    }

    return (
        <main className="min-h-screen bg-slate-100 pb-28">
            <header className="bg-slate-900 px-4 py-5 text-white">
                <div className="mx-auto max-w-lg">
                    <p className="text-xs uppercase tracking-wider text-slate-400">{workshop.name}</p>
                    <h1 className="text-xl font-bold">Your {vehicle} inspection</h1>
                    <p className="mt-1 text-sm text-slate-300">
                        {closed ? "This inspection is closed. Thank you." : "Tick what you would like us to do. Nothing is done without your yes."}
                    </p>
                </div>
            </header>

            <div className="mx-auto max-w-lg space-y-4 px-4 pt-4">
                {error && <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800" role="alert">{error}</p>}

                {findings.map((f) => (
                    <article key={f.id} className={`overflow-hidden rounded-xl border-2 bg-white shadow-sm ${f.urgent ? "border-red-400" : "border-amber-300"}`}>
                        <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${f.urgent ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                            {f.urgent ? "Needs attention now" : "Needs attention soon"} · {f.group}
                        </div>
                        <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-lg font-semibold text-slate-800">{f.description}</h2>
                                {f.estimate !== null && <p className="shrink-0 text-lg font-bold tabular-nums text-slate-800">{money(f.estimate, currency)}</p>}
                            </div>
                            {f.comment && <p className="text-base text-slate-700">{f.comment}</p>}
                            {f.readings.length > 0 && (
                                <dl className="flex flex-wrap gap-2 text-sm">
                                    {f.readings.map((r) => <div key={r.label} className="rounded bg-slate-100 px-2 py-1"><dt className="inline text-slate-500">{r.label} </dt><dd className="inline font-semibold tabular-nums">{r.value}</dd></div>)}
                                </dl>
                            )}
                            {f.photos.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto">
                                    {f.photos.map((src) => (
                                        <button key={src} type="button" onClick={() => setZoom(src)} className="shrink-0">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- served through the customer's link, not optimisable */}
                                            <img src={src} alt={f.description} className="h-24 w-24 rounded-lg object-cover" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {f.locked ? (
                                <p className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-base font-semibold text-teal-800"><Check className="h-5 w-5" />Approved — booked into the work</p>
                            ) : closed ? null : (
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" disabled={pending} onClick={() => answer(f, "approve")} aria-pressed={f.answer === "approve"}
                                        className={`flex h-14 items-center justify-center gap-2 rounded-lg text-base font-semibold ${f.answer === "approve" ? "bg-teal-600 text-white" : "border-2 border-teal-600 text-teal-700"}`}>
                                        <Check className="h-5 w-5" />{f.answer === "approve" ? "Yes, do it" : "Do it"}
                                    </button>
                                    <button type="button" disabled={pending} onClick={() => answer(f, "decline")} aria-pressed={f.answer === "decline"}
                                        className={`flex h-14 items-center justify-center gap-2 rounded-lg text-base font-semibold ${f.answer === "decline" ? "bg-slate-700 text-white" : "border-2 border-slate-300 text-slate-600"}`}>
                                        <X className="h-5 w-5" />{f.answer === "decline" ? "Not now" : "Not now"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </article>
                ))}

                {fine.length > 0 && (
                    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-teal-800">
                            {fine.length} things checked and fine <ChevronDown className="h-5 w-5" />
                        </summary>
                        <ul className="mt-2 space-y-1 text-sm text-slate-600">{fine.map((g, n) => <li key={n}>✓ {g.description} <span className="text-slate-400">· {g.group}</span></li>)}</ul>
                    </details>
                )}

                {!closed && (
                    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                        <label htmlFor="comment" className="text-base font-medium text-slate-700">A question or a note for the workshop</label>
                        {sent ? (
                            <p className="text-base text-teal-700">Sent. They will get back to you.</p>
                        ) : (
                            <>
                                <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className="w-full rounded-md border border-slate-300 px-3 py-2 text-base" />
                                <button type="button" disabled={pending || !comment.trim()} onClick={() => start(async () => { const r = await sendComment(token, comment); if (r.ok) setSent(true); else setError(r.message); })}
                                    className="h-11 w-full rounded-lg border-2 border-slate-300 text-base font-semibold text-slate-700 disabled:opacity-50">Send</button>
                            </>
                        )}
                        {workshop.phone && <p className="text-sm text-slate-500">Or phone <a href={`tel:${workshop.phone}`} className="font-semibold text-teal-700">{workshop.phone}</a></p>}
                    </section>
                )}
            </div>

            {!closed && (
                <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
                    <div className="mx-auto flex max-w-lg items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">You have approved</p>
                            <p className="text-xl font-bold tabular-nums text-slate-800">{money(approved, currency)}</p>
                        </div>
                        <p className={`text-sm font-medium ${waiting ? "text-amber-700" : "text-teal-700"}`}>{waiting ? `${waiting} still to answer` : "All answered — thank you"}</p>
                    </div>
                </div>
            )}

            {zoom && (
                <button type="button" onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" aria-label="Close photo">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served through the customer's link */}
                    <img src={zoom} alt="" className="max-h-full max-w-full rounded-lg" />
                </button>
            )}
        </main>
    );
}
