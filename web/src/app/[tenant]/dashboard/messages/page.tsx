import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listCampaigns } from "@/lib/campaigns/queries";
import { listMessages } from "@/lib/messaging/queries";
import { MessageLog } from "@/components/messaging/MessageLog";
import { dateShortIn } from "@/lib/format";

export const metadata = { title: "Messages | MOTION Workshop Manager" };

const STATE = { DRAFT: "Not started", SENDING: "In progress", DONE: "Closed" } as const;

export default async function MessagesPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "messages:send")) notFound();
    const [campaigns, messages] = await Promise.all([listCampaigns(db), listMessages(db, {}, 25)]);

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
                    <p className="text-sm text-slate-500">Bulk messages to a chosen audience, and everything that has gone out.</p>
                </div>
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700">
                    <Link href={`/${slug}/dashboard/messages/new`}><Plus className="w-4 h-4 mr-1" />New campaign</Link>
                </Button>
            </div>

            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Megaphone className="h-3.5 w-3.5" />Campaigns</h2>
                {campaigns.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">
                        No campaigns yet. A campaign picks an audience — customers owing money, a service due, not seen in a year — and lines them up to send one tap each, on WhatsApp or email.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {campaigns.map((c) => (
                            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                                <Link href={`/${slug}/dashboard/messages/${c.id}`} className="min-w-0 flex-1 font-medium text-slate-800 hover:underline">{c.name}</Link>
                                <span className="text-xs text-slate-500">
                                    {c.usePreferred ? "Each customer's preferred way" : c.channel === "EMAIL" ? "Email" : "WhatsApp"} · {dateShortIn(c.createdAt, tenant.timezone)}{c.by ? ` · ${c.by}` : ""}
                                </span>
                                <span className="text-xs tabular-nums text-slate-600">
                                    {c.counts.sent} sent{c.counts.pending > 0 && `, ${c.counts.pending} to go`}{c.counts.skipped > 0 && `, ${c.counts.skipped} left out`}{c.counts.failed > 0 && `, ${c.counts.failed} failed`}
                                </span>
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${c.state === "DONE" ? "text-slate-400" : "text-teal-700"}`}>{STATE[c.state]}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <MessageLog tenant={slug} timezone={tenant.timezone} rows={messages} showCustomer />
        </div>
    );
}
