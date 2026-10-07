import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { asStaff } from "@/lib/admin/platform";
import { normaliseReference } from "@/lib/billing/reference";
import { money, dateShort } from "@/lib/format";
import { withVat } from "@/lib/pricing/plans";
import { bankDetails } from "@/lib/billing/config";
import { ConfirmAction } from "@/app/admin/ConfirmAction";
import { activateAction, cancelAction, reactivateAction, suspendAction } from "@/app/admin/actions";

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
    subscription: { select: { planName: true, priceAmount: true, reference: true, status: true } },
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

    const awaiting = workshops.filter((w) => w.status === "PENDING_PAYMENT" && w.subscription);
    const noPlan = workshops.filter((w) => w.status === "PENDING_PAYMENT" && !w.subscription);
    const live = workshops.filter((w) => w.status === "ACTIVE" || w.status === "PAST_DUE").reverse();
    const off = workshops.filter((w) => w.status === "SUSPENDED" || w.status === "CANCELLED").reverse();
    const bank = bankDetails();

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Workshops</h1>
                    <p className="mt-1 text-[14px] text-slate-600">
                        {awaiting.length === 0
                            ? "Nothing is waiting on a payment."
                            : `${awaiting.length} ${awaiting.length === 1 ? "registration is" : "registrations are"} waiting on a payment.`}
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
                renderActions={(w) => (
                    <>
                        <ConfirmAction
                            action={activateAction}
                            tenantId={w.id}
                            tone="primary"
                            label="Payment received"
                            question={`Has ${w.subscription ? money(withVat(Number(w.subscription.priceAmount))) : "the payment"} arrived under ${w.subscription?.reference}? ${w.name} will be switched on and emailed.`}
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
                title="Registered, no plan chosen"
                hint="Registered before plans were part of the sign-up form. There is no amount yet, so nothing to approve — they choose one at /activate."
                empty="None."
                workshops={noPlan}
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
                hint="Paying workshops, newest first. Suspend one that has stopped paying: access stops, the data stays."
                empty={q ? "No active workshop matches that search." : "None yet."}
                workshops={live}
                renderActions={(w) => (
                    <ConfirmAction
                        action={suspendAction}
                        tenantId={w.id}
                        tone="danger"
                        label="Suspend"
                        question={`Suspend ${w.name}? Nobody there can sign in until it is switched back on. Nothing is deleted, and the owner is emailed how to pay to restore access.`}
                        confirmLabel="Suspend workshop"
                    />
                )}
            />

            <Section
                title="Suspended and cancelled"
                hint="Switched off. Nothing is deleted — switch one back on when their payment arrives and the owner is emailed."
                empty="None."
                workshops={off}
                renderActions={(w) =>
                    w.status === "SUSPENDED" ? (
                        <ConfirmAction
                            action={reactivateAction}
                            tenantId={w.id}
                            label="Switch back on"
                            question={`Switch ${w.name} back on? Everything is as they left it, and the owner is emailed that access is restored.`}
                            confirmLabel="Switch on"
                        />
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
                                    <span className="font-medium">
                                        {a.actor.firstName} {a.actor.lastName}
                                    </span>{" "}
                                    {ACTION_WORDS[a.action] ?? a.action.toLowerCase()} {a.tenant?.name ?? "a workshop since removed"}
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

const ACTION_WORDS: Record<string, string> = {
    ACTIVATED: "approved",
    CANCELLED: "cancelled",
    SUSPENDED: "suspended",
    REACTIVATED: "switched back on",
};

function Section({
    title,
    hint,
    empty,
    workshops,
    renderActions,
}: {
    title: string;
    hint: string;
    empty: string;
    workshops: Workshop[];
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
                                        {w.name} <span className="font-normal text-slate-500">/{w.slug}</span>
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
                                        ) : (
                                            "No plan chosen"
                                        )}
                                    </p>
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
