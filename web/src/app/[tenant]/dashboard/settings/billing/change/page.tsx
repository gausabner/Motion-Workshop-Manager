import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { ChangeProgress } from "@/components/billing/ChangeProgress";
import { RequestChangeForm } from "@/components/billing/RequestChangeForm";
import { amountDue, changeKind, featureDiff, requestRefusal, unusedDays, upgradePeriod } from "@/lib/billing/plan-change";
import { pendingChange, type PendingChange } from "@/lib/billing/plan-change-service";
import { requestPlanChangeAction, withdrawPlanChangeAction } from "@/lib/billing/plan-change-actions";
import { bankDetails, type BankDetails } from "@/lib/billing/config";
import { billingDay } from "@/lib/billing/periods";
import { asPlanId, type PlanId } from "@/lib/plans/features";
import { PLANS, VAT_RATE, withVat, type Plan } from "@/lib/pricing/plans";
import { support } from "@/lib/edition";
import { money } from "@/lib/format";
import { tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("Change plan") };

const PERIOD_LENGTH = { MONTHLY: "one month", QUARTERLY: "three months", ANNUAL: "one year" } as const;
const PER = { MONTHLY: "a month", QUARTERLY: "a quarter", ANNUAL: "a year" } as const;

/**
 * Moving to another plan, as a short flow: choose, review, then pay (a move
 * up) or wait for approval (a move down).
 *
 * One route with the step in the query string, rather than a page per step,
 * so the progress rule stays mounted and moves rather than being redrawn, and
 * so Back in the browser walks back through the steps. Once a request exists
 * the page shows it, whatever the query string says: there is nothing to choose
 * while one is open, and showing the choice again would invite a second.
 */
export default async function ChangePlanPage({
    params,
    searchParams,
}: {
    params: Promise<{ tenant: string }>;
    searchParams: Promise<{ plan?: string; step?: string }>;
}) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership, plan: current } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) {
        return <AccessDenied tenant={slug} group={membership.group} needs="change the workshop's plan" area="Changing plan" />;
    }

    const base = `/${slug}/dashboard/settings/billing`;
    const [sub, pending] = await Promise.all([
        db.subscription.findUnique({
            where: { tenantId: tenant.id },
            select: { planId: true, planName: true, priceAmount: true, status: true, period: true, reference: true, periodEndsAt: true },
        }),
        pendingChange(db, tenant.id),
    ]);

    // Anything that stops a request before a plan is chosen: no subscription
    // to change, or a payment overdue. Checked with a plan that is always a
    // real choice, so only the general reasons can come back here.
    const blocked = pending
        ? null
        : requestRefusal({
              tenantStatus: tenant.status,
              subscription: sub,
              toPlanId: current === "full" ? "workshop" : "full",
              hasPending: false,
          });

    const target = sp.step === "review" ? PLANS.find((p) => p.id === sp.plan && p.price !== null && asPlanId(p.id) !== current) : undefined;
    const kind = pending ? pending.kind : target ? changeKind(current, asPlanId(target.id)!) : null;
    const step = pending ? 2 : target ? 1 : 0;

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Link href={base} className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline">
                    <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
                    Billing
                </Link>
                <h3 className="text-lg font-medium">Change plan</h3>
                <p className="text-sm text-slate-500">
                    {pending
                        ? `Your request to move to ${pending.toPlanName} is logged.`
                        : sub
                          ? `Your workshop is on the ${sub.planName} plan.`
                          : "Your billing is arranged directly with MOTION."}
                </p>
            </div>

            <ChangeProgress kind={kind} current={step} />

            {pending ? (
                <PendingRequest pending={pending} reference={sub?.reference ?? ""} period={sub?.period ?? "MONTHLY"} slug={slug} />
            ) : blocked ? (
                <p className="border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">{blocked}</p>
            ) : target && sub && kind ? (
                <Review
                    slug={slug}
                    current={current}
                    currentName={sub.planName}
                    currentPrice={Number(sub.priceAmount)}
                    target={target}
                    kind={kind}
                    period={sub.period}
                    periodEndsAt={sub.periodEndsAt}
                    base={base}
                />
            ) : (
                <Choose current={current} base={base} />
            )}
        </div>
    );
}

// ── 1. choose ────────────────────────────────────────────────────────────────

function Choose({ current, base }: { current: PlanId | null; base: string }) {
    return (
        <section aria-labelledby="choose-heading" className="space-y-3">
            <h4 id="choose-heading" className="text-sm font-semibold text-slate-900">
                Choose a plan
            </h4>
            <ul className="divide-y divide-slate-200 border border-slate-200 bg-white">
                {PLANS.map((p) => {
                    const id = asPlanId(p.id)!;
                    const mine = id === current;
                    const { gained, lost } = featureDiff(current, id);
                    const row = (
                        <div className="grid gap-x-6 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                                    {p.name}
                                    {mine && <span className="text-[11px] font-medium uppercase tracking-wide text-teal-700">Your plan</span>}
                                </p>
                                <p className="mt-0.5 text-[13px] text-slate-500">{p.who}</p>
                                {!mine && (gained.length > 0 || lost.length > 0) && (
                                    <p className="mt-2 text-[13px] text-slate-700">
                                        {gained.length > 0 ? (
                                            <>
                                                <span className="font-medium text-slate-900">Adds</span> {gained.join(", ")}
                                            </>
                                        ) : (
                                            <>
                                                <span className="font-medium text-slate-900">Locks</span> {lost.join(", ")}
                                            </>
                                        )}
                                    </p>
                                )}
                            </div>
                            <div className="sm:text-right">
                                {p.price === null ? (
                                    <p className="text-[15px] font-semibold text-slate-900">By quote</p>
                                ) : (
                                    <>
                                        <p className="text-[15px] font-semibold tabular-nums text-slate-900">{money(withVat(p.price))}</p>
                                        <p className="text-[12px] text-slate-500">a month incl. {VAT_RATE}% VAT</p>
                                    </>
                                )}
                            </div>
                        </div>
                    );

                    if (mine) {
                        return (
                            <li key={p.id} aria-current="true" className="relative">
                                <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-teal-700" />
                                {row}
                            </li>
                        );
                    }
                    if (p.price === null) {
                        return (
                            <li key={p.id}>
                                {row}
                                <p className="-mt-2 px-4 pb-4 text-[13px] text-slate-600">
                                    Quoted per site.{" "}
                                    <Link href="/support" className="font-medium text-teal-700 hover:underline">
                                        Request a quote
                                    </Link>
                                </p>
                            </li>
                        );
                    }
                    return (
                        <li key={p.id}>
                            <Link
                                href={`${base}/change?step=review&plan=${p.id}`}
                                className="group block transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
                            >
                                {row}
                                <span className="-mt-2 flex items-center gap-1 px-4 pb-4 text-[13px] font-medium text-teal-700">
                                    {changeKind(current, id) === "upgrade" ? `Move up to ${p.name}` : `Move down to ${p.name}`}
                                    <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

// ── 2. review ────────────────────────────────────────────────────────────────

function Review(props: {
    slug: string;
    current: PlanId | null;
    currentName: string;
    currentPrice: number;
    target: Plan;
    kind: "upgrade" | "downgrade";
    period: keyof typeof PERIOD_LENGTH;
    periodEndsAt: Date | null;
    base: string;
}) {
    const { target, kind, period } = props;
    const to = asPlanId(target.id)!;
    const price = target.price!;
    const { gained, lost } = featureDiff(props.current, to);
    const due = amountDue(kind, price);
    const now = new Date();
    const restart = upgradePeriod(now, period);
    const gaveUp = unusedDays(props.periodEndsAt, now);

    return (
        <section aria-labelledby="review-heading" className="space-y-6">
            <h4 id="review-heading" className="text-sm font-semibold text-slate-900">
                {kind === "upgrade" ? `Move up to ${target.name}` : `Move down to ${target.name}`}
            </h4>

            <dl className="grid border border-slate-200 bg-white sm:grid-cols-2">
                <Pair label="Plan" from={props.currentName} to={target.name} />
                <Pair label="Price" from={`${money(withVat(props.currentPrice))} ${PER[period]}`} to={`${money(withVat(price))} ${PER[period]}`} hint={`Including VAT at ${VAT_RATE}%`} />
            </dl>

            {(gained.length > 0 || lost.length > 0) && (
                <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{gained.length ? "Added to your workshop" : "Locked on your workshop"}</p>
                    <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        {(gained.length ? gained : lost).map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                                {gained.length ? (
                                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" strokeWidth={2} />
                                ) : (
                                    <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
                                )}
                                {f}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {kind === "upgrade" ? (
                <div className="border-t border-slate-200 pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">To pay before it is switched on</p>
                    <p className="mt-1 text-[28px] font-semibold leading-tight tabular-nums text-slate-900">{money(due.inclVat)}</p>
                    <p className="text-sm text-slate-500">
                        {money(due.exclVat)} plus {VAT_RATE}% VAT: {PERIOD_LENGTH[period]} at the {target.name} price.
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                        <li>We switch on {target.name} as soon as the payment is confirmed, usually on the same working day.</li>
                        <li>
                            Your paid-up-to date restarts from that day. Confirmed today, you would be paid up to{" "}
                            <span className="font-medium text-slate-900">{billingDay(restart.to)}</span>.
                        </li>
                        {gaveUp > 0 && (
                            <li>
                                The {gaveUp} {gaveUp === 1 ? "day" : "days"} left on your current period are not refunded.
                            </li>
                        )}
                    </ul>
                </div>
            ) : (
                <div className="border-t border-slate-200 pt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">To pay now</p>
                    <p className="mt-1 text-[28px] font-semibold leading-tight tabular-nums text-slate-900">Nothing</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                        <li>We apply the change when we approve it, usually on the same working day. The features above are locked then; your records in them are kept.</li>
                        <li>
                            The lower price applies from your next renewal
                            {props.periodEndsAt ? (
                                <>
                                    {" "}
                                    on <span className="font-medium text-slate-900">{billingDay(props.periodEndsAt)}</span>
                                </>
                            ) : null}
                            .
                        </li>
                    </ul>
                </div>
            )}

            <div className="space-y-2 border-t border-slate-200 pt-5">
                <RequestChangeForm
                    action={requestPlanChangeAction.bind(null, props.slug)}
                    planId={target.id}
                    label="Request the change"
                    backHref={`${props.base}/change`}
                />
                <p className="text-[13px] text-slate-500">
                    We email you a confirmation of the request{kind === "upgrade" ? ", with the payment details" : ""}.
                </p>
            </div>
        </section>
    );
}

function Pair({ label, from, to, hint }: { label: string; from: string; to: string; hint?: string }) {
    return (
        <div className="border-b border-slate-200 px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm text-slate-500">
                <span className="line-through decoration-slate-300">{from}</span>
            </dd>
            <dd className="text-[15px] font-semibold tabular-nums text-slate-900">{to}</dd>
            {hint && <dd className="mt-0.5 text-[12px] text-slate-500">{hint}</dd>}
        </div>
    );
}

// ── 3. requested ─────────────────────────────────────────────────────────────

function PendingRequest({ pending, reference, period, slug }: { pending: PendingChange; reference: string; period: keyof typeof PERIOD_LENGTH; slug: string }) {
    const bank = bankDetails();
    const reach = support().email;
    const up = pending.kind === "upgrade";
    return (
        <section aria-labelledby="pending-heading" className="space-y-6">
            <div className="space-y-1">
                <h4 id="pending-heading" className="text-sm font-semibold text-slate-900">
                    {up ? `Pay to switch on ${pending.toPlanName}` : "Waiting for approval"}
                </h4>
                <p className="text-sm text-slate-600">
                    {up
                        ? `Requested on ${billingDay(pending.requestedAt)}. We switch on ${pending.toPlanName} as soon as the payment is confirmed, and email you the tax invoice.`
                        : `Requested on ${billingDay(pending.requestedAt)}. We apply the change shortly and email you when it is done.`}
                </p>
            </div>

            {up && (
                <>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">Amount to pay</p>
                        <p className="mt-1 text-[28px] font-semibold leading-tight tabular-nums text-slate-900">{money(pending.amountInclVat)}</p>
                        <p className="text-sm text-slate-500">
                            {money(pending.amountExclVat)} plus {VAT_RATE}% VAT: {PERIOD_LENGTH[period]} at the {pending.toPlanName} price.
                        </p>
                    </div>
                    <BankRows bank={bank} reference={reference} />
                    <p className="text-sm text-slate-600">
                        Use <span className="font-mono font-semibold text-slate-900">{reference}</span> as the reference, so that we can match the
                        payment to your workshop.
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
                </>
            )}

            <form action={withdrawPlanChangeAction.bind(null, slug, pending.id)} className="border-t border-slate-200 pt-5">
                <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-sm border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900"
                >
                    Withdraw request
                </button>
                <p className="mt-2 text-[13px] text-slate-500">
                    {up ? "If you have already paid, contact us instead, so that the payment can be matched." : "Your current plan stays as it is."}
                </p>
            </form>
        </section>
    );
}

function BankRows({ bank, reference }: { bank: BankDetails | null; reference: string }) {
    if (!bank) return <p className="text-sm text-slate-600">Contact MOTION for the bank details.</p>;
    const rows: [string, string, boolean][] = [
        ["Bank", bank.bankName, false],
        ["Account name", bank.accountName, false],
        ["Account number", bank.accountNumber, true],
        ["Branch code", bank.branchCode, true],
        ...(bank.accountType ? [["Account type", bank.accountType, false] as [string, string, boolean]] : []),
        ["Reference", reference, true],
    ];
    return (
        <dl className="border border-slate-200 bg-white text-sm">
            {rows.map(([label, value, mono]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-4 py-2.5 last:border-b-0">
                    <dt className="text-slate-600">{label}</dt>
                    <dd className={`text-right text-slate-900 ${mono ? "select-all font-mono tabular-nums" : ""} ${label === "Reference" ? "font-semibold" : ""}`}>{value}</dd>
                </div>
            ))}
        </dl>
    );
}
