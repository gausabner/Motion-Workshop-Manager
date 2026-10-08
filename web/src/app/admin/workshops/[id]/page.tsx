import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { asStaff } from "@/lib/admin/platform";
import { billingDay, anchorDayOf, periodStartFor } from "@/lib/billing/periods";
import { recipientGaps } from "@/lib/billing/invoices";
import { withVat } from "@/lib/pricing/plans";
import { money, dateShort } from "@/lib/format";
import { ConfirmAction } from "@/app/admin/ConfirmAction";
import { issueInvoiceAction, recordEarlierPaymentAction, resendInvoiceAction } from "@/app/admin/actions";
import { actorName, describeAction } from "@/app/admin/activity";

/**
 * One workshop's account with MOTION: what it pays, every payment staff have
 * confirmed, and the tax invoice for each.
 *
 * Still nothing of the workshop's own — no customers, jobs or money. Its
 * company name, address and VAT number are shown because they are what its
 * invoices are addressed to, and a gap there is a gap in a tax invoice.
 */

const STATUS: Record<string, string> = {
    PENDING_PAYMENT: "Waiting on payment",
    ACTIVE: "Active",
    PAST_DUE: "Read-only — payment overdue",
    SUSPENDED: "Suspended",
    CANCELLED: "Cancelled",
};

export default async function WorkshopAccountPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const w = await asStaff((tx) =>
        tx.tenant.findUnique({
            where: { id },
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                createdAt: true,
                vatNumber: true,
                address1: true,
                city: true,
                subscription: {
                    select: { planName: true, priceAmount: true, period: true, reference: true, status: true, startedAt: true, periodEndsAt: true },
                },
                memberships: {
                    where: { group: "OWNER" },
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { user: { select: { firstName: true, lastName: true, email: true, mobile: true } } },
                },
                subscriptionPayments: {
                    orderBy: { confirmedAt: "desc" },
                    select: {
                        id: true,
                        confirmedAt: true,
                        periodFrom: true,
                        periodTo: true,
                        amountInclVat: true,
                        note: true,
                        confirmedBy: { select: { firstName: true, lastName: true } },
                        invoice: { select: { id: true, number: true, emailedAt: true } },
                    },
                },
                platformAuditEvents: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    select: { id: true, action: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } },
                },
            },
        }),
    );
    if (!w) notFound();

    const owner = w.memberships[0]?.user ?? null;
    const sub = w.subscription;
    const payments = w.subscriptionPayments;
    const gaps = recipientGaps(w);
    const dated = sub?.status === "ACTIVE" && sub.periodEndsAt ? sub.periodEndsAt : null;
    const earlierFrom = sub && dated ? periodStartFor(dated, sub.period, sub.startedAt ? anchorDayOf(sub.startedAt) : anchorDayOf(dated)) : null;

    return (
        <div className="space-y-6">
            <Link href="/admin" className="inline-flex min-h-9 items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" aria-hidden /> All workshops
            </Link>

            <div>
                <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">{w.name}</h1>
                <p className="mt-1 text-[14px] text-slate-600">
                    /{w.slug} · {STATUS[w.status] ?? w.status} · registered {dateShort(w.createdAt)}
                </p>
                {owner && (
                    <p className="mt-1 text-[14px] text-slate-600">
                        {owner.firstName} {owner.lastName} ·{" "}
                        <a href={`mailto:${owner.email}`} className="text-teal-700 hover:underline">
                            {owner.email}
                        </a>
                        {owner.mobile ? ` · ${owner.mobile}` : ""}
                    </p>
                )}
            </div>

            <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-[14px]">
                {sub ? (
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-4">
                        <Fact label="Plan" value={sub.planName} />
                        <Fact label="Amount" value={`${money(withVat(Number(sub.priceAmount)))} incl. VAT`} />
                        <Fact label="Reference" value={sub.reference} mono />
                        <Fact label="Paid up to" value={dated ? billingDay(dated) : "Not dated"} />
                    </dl>
                ) : (
                    <p className="text-slate-600">No billing set up.</p>
                )}
            </section>

            {gaps.length > 0 && (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                    Its tax invoices are addressed without the workshop&apos;s {gaps.join(" and ")}. A VAT-registered workshop needs its address and
                    VAT number on the invoice to claim the VAT back, so ask the owner to complete Settings → Company profile. Invoices already
                    issued keep what they were issued with.
                </p>
            )}

            <section className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                    <h2 className="text-[14px] font-semibold text-slate-900">Payments and tax invoices</h2>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                        Every payment confirmed on this page has its tax invoice, emailed to the owner. An issued invoice cannot be changed or deleted.
                    </p>
                </div>

                {payments.length === 0 ? (
                    <div className="space-y-3 px-4 py-4 text-[13px] text-slate-600">
                        <p>No payment recorded in MOTION for this workshop.</p>
                        {sub && dated && earlierFrom && (
                            <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-start sm:justify-between">
                                <p className="max-w-xl">
                                    If it paid for the period it is in now — {billingDay(earlierFrom)} to {billingDay(dated)} — before MOTION recorded payments,
                                    record that payment here and its tax invoice is issued and emailed. Only if the money really arrived: an issued tax invoice
                                    stays on the record.
                                </p>
                                <ConfirmAction
                                    action={recordEarlierPaymentAction}
                                    tenantId={w.id}
                                    tone="primary"
                                    label="Record a payment already received"
                                    question={`Did ${w.name} pay ${money(withVat(Number(sub.priceAmount)))} for ${billingDay(earlierFrom)} to ${billingDay(dated)}? A tax invoice is issued for it and emailed to the owner, and cannot be withdrawn.`}
                                    confirmLabel="Yes — record and invoice it"
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-[13px]">
                            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Confirmed</th>
                                    <th className="px-4 py-2 font-medium">Covers</th>
                                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                                    <th className="px-4 py-2 font-medium">By</th>
                                    <th className="px-4 py-2 font-medium">Tax invoice</th>
                                    <th className="px-4 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments.map((p) => (
                                    <tr key={p.id} className="align-top">
                                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">{billingDay(p.confirmedAt)}</td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {billingDay(p.periodFrom)} – {billingDay(p.periodTo)}
                                            {p.note && <span className="mt-0.5 block text-[12px] text-slate-500">{p.note}</span>}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">{money(Number(p.amountInclVat))}</td>
                                        <td className="px-4 py-3 text-slate-700">{p.confirmedBy ? `${p.confirmedBy.firstName} ${p.confirmedBy.lastName}` : "—"}</td>
                                        <td className="px-4 py-3">
                                            {p.invoice ? (
                                                <>
                                                    <a
                                                        href={`/admin/invoices/${p.invoice.id}/pdf`}
                                                        target="_blank"
                                                        rel="noopener"
                                                        className="inline-flex items-center gap-1.5 font-medium text-teal-700 hover:underline"
                                                    >
                                                        <FileText className="h-4 w-4" aria-hidden />
                                                        {p.invoice.number}
                                                    </a>
                                                    <span className={`mt-0.5 block text-[12px] ${p.invoice.emailedAt ? "text-slate-500" : "font-medium text-amber-700"}`}>
                                                        {p.invoice.emailedAt ? `Emailed ${billingDay(p.invoice.emailedAt)}` : "Not emailed yet"}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-slate-500">None — confirmed before invoices existed</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {p.invoice ? (
                                                <ConfirmAction
                                                    key={`send-${p.invoice.id}`}
                                                    action={resendInvoiceAction}
                                                    tenantId={w.id}
                                                    label={p.invoice.emailedAt ? "Send again" : "Send"}
                                                    question={`Email tax invoice ${p.invoice.number} to ${owner?.email ?? "the owner"}?`}
                                                    confirmLabel="Send it"
                                                    fields={{ invoiceId: p.invoice.id }}
                                                />
                                            ) : (
                                                <ConfirmAction
                                                    key={`issue-${p.id}`}
                                                    action={issueInvoiceAction}
                                                    tenantId={w.id}
                                                    tone="primary"
                                                    label="Issue tax invoice"
                                                    question={`Issue a tax invoice for this ${money(Number(p.amountInclVat))} payment and email it to the owner? It cannot be withdrawn.`}
                                                    confirmLabel="Issue and send"
                                                    fields={{ paymentId: p.id }}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white">
                <h2 className="border-b border-slate-200 px-4 py-3 text-[14px] font-semibold text-slate-900">Staff activity on this workshop</h2>
                {w.platformAuditEvents.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-slate-500">None yet.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {w.platformAuditEvents.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]">
                                <span className="text-slate-900">
                                    <span className="font-medium">{actorName(a.actor)}</span> {describeAction(a.action, w.name)}
                                </span>
                                <span className="tabular-nums text-slate-500">{dateShort(a.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className={`mt-0.5 text-slate-900 ${mono ? "select-all font-mono" : ""}`}>{value}</dd>
        </div>
    );
}
