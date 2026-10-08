import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { asStaff } from "@/lib/admin/platform";
import { normaliseReference } from "@/lib/billing/reference";
import { money, dateShort } from "@/lib/format";
import { withVat } from "@/lib/pricing/plans";
import { bankDetails } from "@/lib/billing/config";
import { ConfirmAction } from "@/app/admin/ConfirmAction";
import { ChangePaidUntil, SetUpBilling } from "@/app/admin/BillingForms";
import {
    activateAction,
    cancelAction,
    reactivateAction,
    renewAction,
    setPaidUntilAction,
    setUpBillingAction,
    suspendAction,
} from "@/app/admin/actions";
import { billingDay, billingInputValue, readOnlyFrom, renewalRules, standing } from "@/lib/billing/periods";
import { PLANS } from "@/lib/pricing/plans";
import { actorName, describeAction } from "@/app/admin/activity";

/**
 * Registrations, and every workshop's standing with MOTION.
 *
 * The page a member of staff opens with a bank statement beside it. What they
 * need first is what is waiting on them — registrations with a reference and
 * no confirmed payment — so that leads, oldest first, because the workshop
 * that has waited longest is the one most likely to be ringing.
 *
 * Search takes a payment reference in whatever shape it arrived on the
 * statement — `mot 7kq x4f` finds `MOT-7KQX4F` — or a workshop's name,
 * address or owner's email.
 *
 * What is not here, on purpose: any workshop's customers, vehicles, documents
 * or money. Approving a deposit needs what a workshop agreed to pay and how to
 * reach its owner; it needs nothing from its books, and the database would
 * refuse this page those rows even if it asked.
 */

const WORKSHOP_SELECT = {
    id: true,
    slug: true,
    name: true,
    status: true,
    createdAt: true,
    subscription: { select: { planName: true, priceAmount: true, reference: true, status: true, period: true, periodEndsAt: true } },
    memberships: {
        where: { group: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { firstName: true, lastName: true, email: true, mobile: true } } },
    },
} satisfies Prisma.TenantSelect;

type Workshop = Prisma.TenantGetPayload<{ select: typeof WORKSHOP_SELECT }>;

function searchWhere(q: string): Prisma.TenantWhereInput | undefined {
    const term = q.trim();
    if (!term) return undefined;
    const reference = normaliseReference(term);
    if (reference) return { subscription: { reference } };
    const lower = term.toLowerCase();
    return {
        OR: [
            { name: { contains: term, mode: "insensitive" } },
            { slug: { contains: lower } },
            { memberships: { some: { group: "OWNER", user: { email: { contains: lower } } } } },
        ],
    };
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q = "" } = await searchParams;

    const { workshops, activity } = await asStaff(async (tx) => ({
        workshops: await tx.tenant.findMany({ where: searchWhere(q), orderBy: { createdAt: "asc" }, select: WORKSHOP_SELECT }),
        activity: await tx.platformAuditEvent.findMany({
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
                id: true,
                action: true,
                createdAt: true,
                actor: { select: { firstName: true, lastName: true } },
                tenant: { select: { name: true } },
            },
        }),
    }));

    const now = new Date();
    const rules = renewalRules();
    const standingOf = (w: Workshop) => standing(w.subscription?.status === "ACTIVE" ? w.subscription.periodEndsAt : null, now, rules);
    const byDue = (a: Workshop, b: Workshop) => (a.subscription?.periodEndsAt?.getTime() ?? 0) - (b.subscription?.periodEndsAt?.getTime() ?? 0);

    const awaiting = workshops.filter((w) => w.status === "PENDING_PAYMENT" && w.subscription);
    const noPlan = workshops.filter((w) => w.status === "PENDING_PAYMENT" && !w.subscription);
    // What is waiting on a renewal, soonest first: the order the bank
    // statement should be read in. Read-only workshops lead because they have
    // waited longest and are the ones most likely to be ringing.
    const due = workshops
        .filter((w) => w.status === "PAST_DUE" || (w.status === "ACTIVE" && ["dueSoon", "grace", "overdue"].includes(standingOf(w))))
        .sort(byDue);
    const live = workshops.filter((w) => w.status === "ACTIVE" && !due.includes(w)).reverse();
    const off = workshops.filter((w) => w.status === "SUSPENDED" || w.status === "CANCELLED").reverse();
    const bank = bankDetails();

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Workshops</h1>
                    <p className="mt-1 text-[14px] text-slate-600">
                        {awaiting.length + due.length === 0
                            ? "Nothing is waiting on a payment."
                            : [
                                  awaiting.length ? `${awaiting.length} new ${awaiting.length === 1 ? "registration" : "registrations"}` : "",
                                  due.length ? `${due.length} ${due.length === 1 ? "renewal" : "renewals"}` : "",
                              ]
                                  .filter(Boolean)
                                  .join(" and ") + " waiting on a payment."}
                    </p>
                </div>
                <form role="search" className="relative w-full max-w-sm">
                    <label htmlFor="q" className="sr-only">
                        Search by reference, workshop or owner email
                    </label>
                    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        id="q"
                        name="q"
                        type="search"
                        defaultValue={q}
                        placeholder="Reference, workshop or owner email"
                        className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                </form>
            </div>

            {/* Said rather than discovered: without these the customer is shown
                no bank details at all, which is how a registration stalls. */}
            {!bank && (
                <p role="alert" className="rounded-md border border-amber-400 bg-white px-4 py-3 text-[13px] text-slate-900">
                    No bank details are configured on this server, so new customers are not being told where to pay. Set the
                    BILLING_BANK_* values in the server&apos;s environment.
                </p>
            )}

            <Section
                title="Waiting on payment"
                hint="Match the reference to the bank statement, then approve. The owner is emailed the moment you do."
                empty={q ? "No waiting registration matches that search." : "Nothing waiting. New registrations appear here and are emailed to the team."}
                workshops={awaiting}
                now={now}
                renderActions={(w) => (
                    <>
                        <ConfirmAction
                            action={activateAction}
                            tenantId={w.id}
                            tone="primary"
                            label="Payment received"
                            question={`Has ${w.subscription ? money(withVat(Number(w.subscription.priceAmount))) : "the payment"} arrived under ${w.subscription?.reference}? ${w.name} will be switched on, and the owner emailed with a tax invoice.`}
                            confirmLabel="Yes — switch it on"
                        />
                        <ConfirmAction
                            action={cancelAction}
                            tenantId={w.id}
                            tone="danger"
                            label="Cancel"
                            question={`Cancel ${w.name}'s registration? They will not be able to sign in to it.`}
                            confirmLabel="Cancel registration"
                        />
                    </>
                )}
            />

            <Section
                title="Renewals due"
                hint="Soonest first. Match the reference on the statement, then record it — the date moves on a period, read-only lifts, and the owner gets a receipt."
                empty={q ? "No renewal matches that search." : "Nothing due. Workshops appear here a week before their date, and the team is emailed each morning one does."}
                workshops={due}
                now={now}
                renderActions={(w) => (
                    <>
                        <RenewButton w={w} />
                        <ChangePaidUntil action={setPaidUntilAction} tenantId={w.id} current={billingInputValue(w.subscription!.periodEndsAt!)} />
                        {w.status === "PAST_DUE" && (
                            <ConfirmAction
                                action={reactivateAction}
                                tenantId={w.id}
                                label="Lift read-only"
                                question={`Lift read-only for ${w.name} without a payment? It goes read-only again tomorrow morning unless its date is changed or a payment is recorded.`}
                                confirmLabel="Lift read-only"
                            />
                        )}
                        <SuspendButton w={w} />
                    </>
                )}
            />

            <Section
                title="Registered, no plan chosen"
                hint="Registered before plans were part of the sign-up form. There is no amount yet, so nothing to approve — they choose one at /activate."
                empty="None."
                workshops={noPlan}
                now={now}
                renderActions={(w) => (
                    <ConfirmAction
                        action={cancelAction}
                        tenantId={w.id}
                        tone="danger"
                        label="Cancel"
                        question={`Cancel ${w.name}'s registration?`}
                        confirmLabel="Cancel registration"
                    />
                )}
            />

            <Section
                title="Active"
                hint="Paid up, newest first. A workshop moves to Renewals due a week before its date. One that pays early is recorded from its own page — click its name."
                empty={q ? "No active workshop matches that search." : "None yet."}
                workshops={live}
                now={now}
                renderActions={(w) => (
                    <>
                        {/* No "Payment received" here. These workshops are paid up
                            for weeks yet, and a payment button on a row that
                            does not move after the press is how one workshop
                            was renewed three times in a minute. An early payment
                            is recorded from the workshop's page, which says
                            exactly which period it buys. */}
                        {w.subscription?.status === "ACTIVE" && w.subscription.periodEndsAt ? (
                            <ChangePaidUntil action={setPaidUntilAction} tenantId={w.id} current={billingInputValue(w.subscription.periodEndsAt)} />
                        ) : !w.subscription ? (
                            <SetUpBilling
                                action={setUpBillingAction}
                                tenantId={w.id}
                                plans={PLANS.map((p) => ({ id: p.id, name: p.name, price: p.price }))}
                                defaultPaidUntil={billingInputValue(now)}
                            />
                        ) : null}
                        <SuspendButton w={w} />
                    </>
                )}
            />

            <Section
                title="Suspended and cancelled"
                hint="Switched off. Nothing is deleted. When a suspended workshop pays, record it with Payment received — that restores access and moves its date on. Switch back on restores access without a payment."
                empty="None."
                workshops={off}
                now={now}
                renderActions={(w) =>
                    w.status === "SUSPENDED" ? (
                        <>
                            {w.subscription?.status === "ACTIVE" && w.subscription.periodEndsAt && <RenewButton w={w} />}
                            <ConfirmAction
                                action={reactivateAction}
                                tenantId={w.id}
                                label="Switch back on"
                                question={`Switch ${w.name} back on without a payment? If its paid-up-to date has passed, it goes read-only again tomorrow morning.`}
                                confirmLabel="Switch on"
                            />
                        </>
                    ) : null
                }
            />

            <section className="rounded-lg border border-slate-200 bg-white">
                <h2 className="border-b border-slate-200 px-4 py-3 text-[14px] font-semibold text-slate-900">Recent staff activity</h2>
                {activity.length === 0 ? (
                    <p className="px-4 py-4 text-[13px] text-slate-500">Nothing yet. Every approval, suspension and cancellation is recorded here.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {activity.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-[13px]">
                                <span className="text-slate-900">
                                    <span className="font-medium">{actorName(a.actor)}</span> {describeAction(a.action, a.tenant?.name)}
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

function RenewButton({ w }: { w: Workshop }) {
    const sub = w.subscription!;
    return (
        <ConfirmAction
            action={renewAction}
            tenantId={w.id}
            tone="primary"
            label="Payment received"
            question={`Has ${money(withVat(Number(sub.priceAmount)))} arrived under ${sub.reference}? ${w.name} will be paid up a further ${PERIOD_WORDS[sub.period]}${
                w.status === "ACTIVE" ? "" : ", full access restored"
            }, and the owner emailed a receipt with its tax invoice.`}
            confirmLabel="Yes — record it"
            fields={{ expectedEnd: sub.periodEndsAt?.toISOString() ?? "" }}
        />
    );
}

function SuspendButton({ w }: { w: Workshop }) {
    return (
        <ConfirmAction
            action={suspendAction}
            tenantId={w.id}
            tone="danger"
            label="Suspend"
            question={`Suspend ${w.name}? Nobody there can sign in until it is switched back on. Nothing is deleted, and the owner is emailed how to pay to restore access.`}
            confirmLabel="Suspend workshop"
        />
    );
}

const PERIOD_WORDS = { MONTHLY: "month", QUARTERLY: "quarter", ANNUAL: "year" } as const;

/** One line saying where a workshop stands with MOTION, in the words staff would use on the phone. */
function BillingLine({ w, now }: { w: Workshop; now: Date }) {
    const sub = w.subscription;
    if (!sub || sub.status !== "ACTIVE" || !sub.periodEndsAt || w.status === "PENDING_PAYMENT" || w.status === "CANCELLED") return null;
    const end = sub.periodEndsAt;
    const rules = renewalRules();
    if (w.status === "PAST_DUE") {
        return <p className="text-[13px] font-medium text-red-700">Read-only — due {billingDay(end)}, not yet paid</p>;
    }
    if (w.status === "SUSPENDED") return <p className="text-[13px] text-slate-600">Was paid up to {billingDay(end)}</p>;
    const s = standing(end, now, rules);
    if (s === "grace") {
        return (
            <p className="text-[13px] font-medium text-amber-700">
                Due {billingDay(end)} — in grace, read-only from {billingDay(readOnlyFrom(end, rules))}
            </p>
        );
    }
    if (s === "overdue") return <p className="text-[13px] font-medium text-amber-700">Due {billingDay(end)} — goes read-only on the next morning run</p>;
    if (s === "dueSoon") return <p className="text-[13px] font-medium text-slate-900">Due {billingDay(end)}</p>;
    return <p className="text-[13px] text-slate-600">Paid up to {billingDay(end)}</p>;
}

function Section({
    title,
    hint,
    empty,
    workshops,
    now,
    renderActions,
}: {
    title: string;
    hint: string;
    empty: string;
    workshops: Workshop[];
    now: Date;
    renderActions: (w: Workshop) => React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-[14px] font-semibold text-slate-900">
                    {title} <span className="ml-1 tabular-nums font-normal text-slate-500">{workshops.length}</span>
                </h2>
                <p className="mt-0.5 text-[12.5px] text-slate-500">{hint}</p>
            </div>
            {workshops.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-slate-500">{empty}</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {workshops.map((w) => {
                        const owner = w.memberships[0]?.user;
                        return (
                            <li key={w.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-[15px] font-medium text-slate-900">
                                        <Link href={`/admin/workshops/${w.id}`} className="hover:text-teal-700 hover:underline">
                                            {w.name}
                                        </Link>{" "}
                                        <span className="font-normal text-slate-500">/{w.slug}</span>
                                    </p>
                                    {owner && (
                                        <p className="text-[13px] text-slate-600">
                                            {owner.firstName} {owner.lastName} ·{" "}
                                            <a href={`mailto:${owner.email}`} className="text-teal-700 hover:underline">
                                                {owner.email}
                                            </a>
                                            {owner.mobile ? ` · ${owner.mobile}` : ""}
                                        </p>
                                    )}
                                    <p className="text-[13px] text-slate-600">
                                        {w.subscription ? (
                                            <>
                                                {w.subscription.planName} ·{" "}
                                                <span className="tabular-nums">{money(withVat(Number(w.subscription.priceAmount)))}</span> incl VAT ·{" "}
                                                <span className="select-all font-mono font-medium text-slate-900">{w.subscription.reference}</span>
                                            </>
                                        ) : w.status === "PENDING_PAYMENT" ? (
                                            "No plan chosen"
                                        ) : (
                                            "No billing set up — switched on before plans existed"
                                        )}
                                    </p>
                                    <BillingLine w={w} now={now} />
                                    <p className="text-[12px] text-slate-500">Registered {dateShort(w.createdAt)}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">{renderActions(w)}</div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
