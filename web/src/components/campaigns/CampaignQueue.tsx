"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finishCampaignAction, sendRecipientAction, skipRecipientAction } from "@/lib/campaigns/actions";
import type { CampaignRecord } from "@/lib/campaigns/queries";

type Row = CampaignRecord["recipients"][number];

/**
 * The send queue. One tap records the message and opens WhatsApp or the mail
 * app with it ready; the next one is always the top of the list, so a long
 * campaign is worked through without losing the place.
 */
export function CampaignQueue({ tenant, campaign }: { tenant: string; campaign: CampaignRecord }) {
    const router = useRouter();
    const [openUrl, setOpenUrl] = useState<{ id: string; url: string } | null>(null);
    const [error, setError] = useState<string>();
    const [busy, start] = useTransition();
    const pending = campaign.recipients.filter((r) => r.state === "PENDING");
    const done = campaign.recipients.filter((r) => r.state !== "PENDING");

    function send(row: Row) {
        setError(undefined);
        setOpenUrl(null);
        start(async () => {
            const result = await sendRecipientAction(tenant, row.id);
            if (!result.ok) {
                setError(`${row.customer.firstName} ${row.customer.lastName}: ${result.message}`);
                return;
            }
            if (result.url) setOpenUrl({ id: row.id, url: result.url });
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            {error && <p className="rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</p>}

            {openUrl && (
                <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-sm border border-teal-300 bg-teal-50 px-4 py-3">
                    <span className="text-sm text-teal-900">Recorded. Now open it and press send.</span>
                    <a href={openUrl.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white">
                        <ExternalLink className="h-4 w-4" />Open {campaign.channel === "EMAIL" ? "mail app" : "WhatsApp"}
                    </a>
                    <button type="button" onClick={() => setOpenUrl(null)} className="text-xs text-teal-800 underline">Dismiss</button>
                </div>
            )}

            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">To send · {pending.length}</h2>
                    {pending.length > 0 && campaign.state !== "DONE" && (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-500" disabled={busy}
                            onClick={() => { if (window.confirm(`Close this campaign and leave out the remaining ${pending.length}?`)) start(() => finishCampaignAction(tenant, campaign.id)); }}>
                            Close campaign
                        </Button>
                    )}
                </div>
                {pending.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Everyone has been dealt with.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {pending.map((row) => (
                            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-slate-800">{row.customer.firstName} {row.customer.lastName}</span>
                                    <span className="block text-xs text-slate-500">{campaign.channel === "EMAIL" || row.customer.preferredContact === "EMAIL" ? row.customer.email : row.customer.mobile}</span>
                                </span>
                                <Button type="button" size="sm" className="h-8 bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => send(row)}>
                                    {campaign.channel === "EMAIL" ? <Mail className="mr-1 h-3.5 w-3.5" /> : <MessageCircle className="mr-1 h-3.5 w-3.5" />}Send
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-500" disabled={busy} onClick={() => start(() => skipRecipientAction(tenant, row.id))}>Skip</Button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {done.length > 0 && (
                <section className="rounded-sm border border-slate-200 bg-white">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dealt with · {done.length}</h2>
                    <ul className="divide-y divide-slate-100 text-sm">
                        {done.map((row) => (
                            <li key={row.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                                <span className="text-slate-700">{row.customer.firstName} {row.customer.lastName}</span>
                                <span className={`text-xs ${row.state === "SENT" ? "text-teal-700" : row.state === "FAILED" ? "text-red-600" : "text-slate-400"}`}>
                                    {row.state === "SENT" ? (row.message?.status === "HANDED_OFF" ? `Handed to ${row.message.channel === "EMAIL" ? "mail app" : "WhatsApp"}` : "Sent") : row.state === "FAILED" ? "Failed" : "Left out"}
                                    {row.note ? ` — ${row.note}` : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
