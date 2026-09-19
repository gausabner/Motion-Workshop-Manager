import Link from "next/link";
import { Eye, Mail, MessageCircle, MessageSquare } from "lucide-react";
import type { MessageChannel } from "@prisma/client";
import { RevokeLinkButton } from "@/components/messaging/RevokeLinkButton";
import type { MessageRow } from "@/lib/messaging/queries";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";

const CHANNEL_ICON: Record<MessageChannel, typeof MessageCircle> = { WHATSAPP: MessageCircle, EMAIL: Mail, SMS: MessageSquare };
const CHANNEL_LABEL: Record<MessageChannel, string> = { WHATSAPP: "WhatsApp", EMAIL: "Email", SMS: "SMS" };

const when = (d: Date, timeZone: string) =>
    d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone });

/**
 * Everything said to a customer, with the one delivery fact we can actually
 * vouch for: whether they opened what they were sent.
 *
 * "Handed to WhatsApp" is worded that way on purpose. The message opened in
 * the sender's own WhatsApp; whether they pressed send there is not something
 * this app can see, and it does not pretend to.
 */
export function MessageLog({ tenant, timezone = "Africa/Windhoek", rows, showSubject = true, showCustomer = false, empty = "Nothing has been sent yet." }: { tenant: string; timezone?: string; rows: MessageRow[]; showSubject?: boolean; showCustomer?: boolean; empty?: string }) {
    const base = `/${tenant}/dashboard`;
    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Messages</h3>
            {rows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">{empty}</p>
            ) : (
                <ol className="divide-y divide-slate-100">
                    {rows.map((row) => {
                        const Icon = CHANNEL_ICON[row.channel];
                        const link = row.shareLink;
                        const live = link && !link.revokedAt && link.expiresAt > new Date();
                        return (
                            <li key={row.id} className="px-4 py-3 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-slate-700">
                                        <Icon className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium">
                                            {row.status === "HANDED_OFF" ? `Handed to ${CHANNEL_LABEL[row.channel]}` : row.status === "FAILED" ? `${CHANNEL_LABEL[row.channel]} failed` : `Sent by ${CHANNEL_LABEL[row.channel]}`}
                                        </span>
                                        <span className="text-slate-400">to {row.channel === "WHATSAPP" ? `+${row.recipient}` : row.recipient}</span>
                                        {showCustomer && row.customer && (
                                            <Link href={`${base}/customers/${row.customer.id}`} className="text-slate-500 hover:text-teal-700">
                                                · {row.customer.firstName} {row.customer.lastName}
                                            </Link>
                                        )}
                                        {showSubject && row.document && (
                                            <Link href={`${base}/documents/${row.document.id}`} className="text-slate-500 hover:text-teal-700">
                                                · {DOCUMENT_TYPE_LABELS[row.document.type].toLowerCase()} {row.document.number ?? row.document.jobNumber ?? ""}
                                            </Link>
                                        )}
                                        {showSubject && row.payment && (
                                            <Link href={`${base}/payments/${row.payment.id}`} className="text-slate-500 hover:text-teal-700">
                                                · {row.payment.direction === "REFUND" ? "refund" : "receipt"} {row.payment.number}
                                            </Link>
                                        )}
                                    </span>
                                    <span className="text-xs text-slate-400">{row.sentBy ? `${row.sentBy} · ` : ""}{when(row.createdAt, timezone)}</span>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-3 pl-6 text-xs">
                                    {row.error && <span className="text-red-600">{row.error}</span>}
                                    {link?.firstOpenedAt ? (
                                        <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                                            <Eye className="w-3.5 h-3.5" />
                                            Opened {when(link.firstOpenedAt, timezone)}{link.openCount > 1 ? ` · ${link.openCount} times, last ${when(link.lastOpenedAt!, timezone)}` : ""}
                                        </span>
                                    ) : link && row.status !== "FAILED" ? (
                                        <span className="text-slate-400">Not opened yet</span>
                                    ) : null}
                                    {link?.revokedAt && <span className="text-red-700">Link withdrawn {when(link.revokedAt, timezone)}</span>}
                                    {link && !link.revokedAt && link.expiresAt <= new Date() && <span className="text-slate-400">Link expired</span>}
                                    {live && <RevokeLinkButton tenant={tenant} shareLinkId={link.id} />}
                                </div>

                                <details className="mt-1 pl-6">
                                    <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">What was sent</summary>
                                    {row.subject && <p className="mt-1 text-xs font-medium text-slate-600">{row.subject}</p>}
                                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{row.body}</p>
                                </details>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
