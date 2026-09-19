import Link from "next/link";
import { Globe } from "lucide-react";
import { SendDialog } from "@/components/messaging/SendDialog";
import { RevokeLinkButton } from "@/components/messaging/RevokeLinkButton";
import { dateShortIn } from "@/lib/format";

export type PortalLinkRow = { id: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; openCount: number; lastOpenedAt: Date | null };

/**
 * The portal from the counter: send the customer their link, see whether they
 * use it, withdraw one that went to the wrong phone, and look at exactly what
 * they see.
 */
export function PortalPanel({ tenant, timezone, customerId, enabled, canSend, canConfigure, links }: {
    tenant: string; timezone: string; customerId: string; enabled: boolean; canSend: boolean; canConfigure: boolean; links: PortalLinkRow[];
}) {
    const now = new Date();
    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b bg-slate-50">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Customer portal</h2>
                <div className="flex items-center gap-2">
                    <Link href={`/${tenant}/dashboard/customers/${customerId}/portal`} className="text-xs font-medium text-teal-700 hover:underline">View as customer</Link>
                    {enabled && canSend && <SendDialog tenant={tenant} target={{ kind: "PORTAL", customerId }} label="portal link" />}
                </div>
            </div>
            {!enabled ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                    The portal is off, so no link can be sent.{" "}
                    {canConfigure && <Link href={`/${tenant}/dashboard/settings/portal`} className="font-medium text-teal-700 hover:underline">Turn it on in settings</Link>}
                </p>
            ) : links.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No portal link sent yet. Send one and the customer can see their invoices, vehicles and anything waiting for approval.</p>
            ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                    {links.map((l) => {
                        const live = !l.revokedAt && l.expiresAt > now;
                        return (
                            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                                <span className="text-slate-700">Sent {dateShortIn(l.createdAt, timezone)}</span>
                                <span className="text-slate-500">
                                    {l.openCount > 0 ? `opened ${l.openCount} time${l.openCount === 1 ? "" : "s"}, last ${dateShortIn(l.lastOpenedAt, timezone)}` : "not opened yet"}
                                </span>
                                <span className={`ml-auto text-xs ${live ? "text-slate-400" : "text-slate-400 line-through"}`}>
                                    {l.revokedAt ? `withdrawn ${dateShortIn(l.revokedAt, timezone)}` : l.expiresAt > now ? `works until ${dateShortIn(l.expiresAt, timezone)}` : `expired ${dateShortIn(l.expiresAt, timezone)}`}
                                </span>
                                {live && canSend && <RevokeLinkButton tenant={tenant} shareLinkId={l.id} />}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
