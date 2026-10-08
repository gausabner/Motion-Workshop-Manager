import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { bankDetails } from "@/lib/billing/config";
import { recipientGaps } from "@/lib/billing/invoices";
import { billingDay, readOnlyFrom, renewalRules, standing } from "@/lib/billing/periods";
import { VAT_RATE, withVat } from "@/lib/pricing/plans";
import { support } from "@/lib/edition";
import { money } from "@/lib/format";

export const metadata = { title: "Billing | MOTION Workshop Manager" };

const PERIOD = { MONTHLY: "Monthly", QUARTERLY: "Quarterly", ANNUAL: "Annually" } as const;

/**
 * What this workshop pays MOTION, when it is next due, and how to pay it.
 *
 * Every member can open it, because it is where a read-only workshop sends
 * anybody who tried to raise a document — and a service advisor who was just
 * refused an invoice deserves to know why. The amounts, bank details and
 * history are for whoever can manage settings; everyone else is told who can.
 */
export default async function BillingPage({
    params,
    searchParams,
}: {
    params: Promise<{ tenant: string }>;
    searchParams: Promise<{ readonly?: string }>;
}) {
    const { tenant: slug } = await params;
    const { readonly } = await searchParams;
    const { tenant, membership, db } = await requireTenant(slug);
    const manager = can(membership, "settings:manage");

    const sub = await db.subscription.findUnique({
        where: { tenantId: tenant.id },
        select: { planName: true, priceAmount: true, period: true, reference: true, status: true, periodEndsAt: true },
    });
    const payments = manager
        ? await db.subscriptionPayment.findMany({
              where: { tenantId: tenant.id },
              orderBy: { confirmedAt: "desc" },
              take: 24,
              select: { id: true, confirmedAt: true, periodFrom: true, periodTo: true, amountInclVat: true, invoice: { select: { id: true, number: true } } },
          })
        : [];

    const gaps = manager ? recipientGaps(tenant) : [];
    const rules = renewalRules();
    const end = sub?.status === "ACTIVE" ? sub.periodEndsAt : null;
    const s = standing(end, new Date(), rules);
    const pastDue = tenant.status === "PAST_DUE";
    const bank = bankDetails();
    const reach = support().email;

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Billing</h3>
                <p className="text-sm text-slate-500">Your MOTION subscription: what it costs, when it is due, and how to pay.</p>
            </div>
            <div className="border-t border-slate-200" />

            {(pastDue || readonly) && (
                <div role="alert" className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                    <div className="space-y-1 text-sm text-slate-800">
                        <p className="font-semibold text-slate-900">MOTION is read-only until the subscription is paid</p>
                        <p>
                            {end ? `The payment due on ${billingDay(end)} has not arrived. ` : ""}
                            Everyone can still sign in, see every customer, vehicle and job, print and export. New quotes, job cards and
                            invoices are paused, and come back as soon as MOTION confirms the payment.
                        </p>
                        {!manager && <p>Your workshop owner can see how to pay on this page.</p>}
                    </div>
                </div>
            )}

            {!sub || sub.status !== "ACTIVE" ? (
                <p className="text-sm text-slate-600">
                    Billing for this workshop is arranged directly with MOTION.
                    {reach && (
                        <>
                            {" "}
                            Questions to{" "}
                            <a href={`mailto:${reach}`} className="font-medium text-teal-700 hover:underline">
                                {reach}
                            </a>
                            .
                        </>
                    )}
                </p>
            ) : (
                <>
                    <dl className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-2">
                        <Cell label="Plan" value={sub.planName} />
                        <Cell
                            label={pastDue || s === "grace" || s === "overdue" ? "Was due" : "Paid up to"}
                            value={end ? billingDay(end) : "Not dated yet"}
                            emphasis={pastDue || s === "grace" || s === "overdue"}
                        />
                        {manager && (
                            <>
                                <Cell
                                    label="Amount"
                                    value={`${money(withVat(Number(sub.priceAmount)))} incl. ${VAT_RATE}% VAT`}
                                    hint={`${money(Number(sub.priceAmount))} excl. VAT · ${PERIOD[sub.period]}`}
                                />
                                <Cell label="Payment reference" value={sub.reference} mono />
                            </>
                        )}
                    </dl>

                    {!pastDue && end && (s === "dueSoon" || s === "grace") && (
                        <p className="text-sm text-slate-700">
                            The next payment is due on {billingDay(end)}.
                            {s === "grace" && ` MOTION becomes read-only on ${billingDay(readOnlyFrom(end, rules))} if it has not arrived.`}
                        </p>
                    )}

                    {manager && (
                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-900">How to pay</h4>
                            {bank ? (
                                <dl className="overflow-hidden rounded-lg border border-slate-200 text-sm">
                                    <Row label="Bank" value={bank.bankName} />
                                    <Row label="Account name" value={bank.accountName} />
                                    <Row label="Account number" value={bank.accountNumber} mono />
                                    <Row label="Branch code" value={bank.branchCode} mono />
                                    {bank.accountType && <Row label="Account type" value={bank.accountType} />}
                                    <Row label="Reference" value={sub.reference} mono strong />
                                </dl>
                            ) : (
                                <p className="text-sm text-slate-600">Contact MOTION for the bank details.</p>
                            )}
                            <p className="text-sm text-slate-600">
                                Always use <span className="font-mono font-semibold text-slate-900">{sub.reference}</span> as the reference — it is
                                how the payment is matched to this workshop.
                                {reach && (
                                    <>
                                        {" "}
                                        Send the proof of payment to{" "}
                                        <a href={`mailto:${reach}`} className="font-medium text-teal-700 hover:underline">
                                            {reach}
                                        </a>
                                        .
                                    </>
                                )}
                            </p>
                        </section>
                    )}

                    {manager && (
                        <section className="space-y-3">
                            <h4 className="text-sm font-semibold text-slate-900">Payments received</h4>
                            {gaps.length > 0 && (
                                <p className="text-sm text-slate-600">
                                    Your tax invoices are addressed from your{" "}
                                    <Link href={`/${slug}/dashboard/settings/company`} className="font-medium text-teal-700 hover:underline">
                                        company profile
                                    </Link>
                                    , which has no {gaps.join(" or ")} yet. Add {gaps.length > 1 ? "them" : "it"} before your next payment if you claim
                                    VAT back — an invoice keeps the details it was issued with.
                                </p>
                            )}
                            {payments.length === 0 ? (
                                <p className="text-sm text-slate-500">None recorded in MOTION yet.</p>
                            ) : (
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Confirmed</th>
                                                <th className="px-3 py-2 font-medium">Covers</th>
                                                <th className="px-3 py-2 text-right font-medium">Amount</th>
                                                <th className="px-3 py-2 font-medium">Tax invoice</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="px-3 py-2 text-slate-700">{billingDay(p.confirmedAt)}</td>
                                                    <td className="px-3 py-2 text-slate-700">
                                                        {billingDay(p.periodFrom)} – {billingDay(p.periodTo)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">{money(Number(p.amountInclVat))}</td>
                                                    <td className="px-3 py-2">
                                                        {p.invoice ? (
                                                            <a
                                                                href={`/${slug}/dashboard/settings/billing/invoices/${p.invoice.id}/pdf`}
                                                                target="_blank"
                                                                rel="noopener"
                                                                className="font-medium text-teal-700 hover:underline"
                                                            >
                                                                {p.invoice.number}
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    )}

                    {!manager && <p className="text-sm text-slate-500">Amounts and payment details are visible to your workshop&apos;s owners and administrators.</p>}
                </>
            )}
        </div>
    );
}

function Cell({ label, value, hint, mono = false, emphasis = false }: { label: string; value: string; hint?: string; mono?: boolean; emphasis?: boolean }) {
    return (
        <div className="bg-white px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className={`mt-1 text-base ${emphasis ? "font-semibold text-amber-800" : "font-medium text-slate-900"} ${mono ? "select-all font-mono" : ""}`}>
                {value}
            </dd>
            {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
        </div>
    );
}

function Row({ label, value, mono = false, strong = false }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-4 py-2.5 last:border-b-0">
            <dt className="text-slate-600">{label}</dt>
            <dd className={`text-right text-slate-900 ${mono ? "select-all font-mono tabular-nums" : ""} ${strong ? "font-semibold" : ""}`}>{value}</dd>
        </div>
    );
}
