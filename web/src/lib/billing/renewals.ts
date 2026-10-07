import "server-only";

import { asScheduler } from "@/lib/admin/platform-tx";
import { decideTick, readOnlyFrom, renewalRules } from "@/lib/billing/periods";
import { sendReadOnlyNotice, sendRenewalReminder, sendTeamDigest, type DigestLine } from "@/lib/billing/renewal-letters";

/**
 * The daily renewal run.
 *
 * Called once a morning by the server's timer. It looks at every dated,
 * confirmed subscription whose workshop is fully active and does at most two
 * things to each: send the reminder for the period that is ending, and — once
 * the grace period has run out — move the workshop to `PAST_DUE`, which is
 * read-only, and tell the owner.
 *
 * It never suspends anybody. Suspension is a person's decision, made on
 * `/admin`; the clock only does what the terms already promise will happen on
 * a date.
 *
 * Safe to run twice, or late. Each step is keyed to the period it is about and
 * claimed with a guarded update before anything is sent, so two runs racing
 * each other send one letter between them.
 */

export type TickSummary = { checked: number; reminded: number; readOnly: number; failedLetters: number };

type Owner = { email: string; firstName: string } | null;

export async function runRenewalTick(
    proof: { schedulerSecretChecked: true },
    now = new Date(),
    /** Tests only: limit the run to these workshops, so it cannot touch anything else in a shared database. */
    only?: string[],
): Promise<TickSummary> {
    const rules = renewalRules();

    const { checked, reminders, readOnly } = await asScheduler(proof, async (tx) => {
        const subs = await tx.subscription.findMany({
            where: { status: "ACTIVE", periodEndsAt: { not: null }, tenant: { status: "ACTIVE" }, ...(only ? { tenantId: { in: only } } : {}) },
            select: {
                id: true,
                tenantId: true,
                priceAmount: true,
                reference: true,
                periodEndsAt: true,
                remindedFor: true,
                overdueNoticeFor: true,
                tenant: {
                    select: {
                        name: true,
                        slug: true,
                        status: true,
                        memberships: {
                            where: { group: "OWNER", status: "ACTIVE" },
                            orderBy: { createdAt: "asc" },
                            take: 1,
                            select: { user: { select: { email: true, firstName: true } } },
                        },
                    },
                },
            },
        });

        const reminders: { line: DigestLine; owner: Owner }[] = [];
        const readOnly: { line: DigestLine; owner: Owner }[] = [];

        for (const sub of subs) {
            const end = sub.periodEndsAt!;
            const decision = decideTick(
                { tenantStatus: sub.tenant.status, periodEndsAt: end, remindedFor: sub.remindedFor, overdueNoticeFor: sub.overdueNoticeFor },
                now,
                rules,
            );
            const line: DigestLine = {
                workshopName: sub.tenant.name,
                slug: sub.tenant.slug,
                reference: sub.reference,
                periodEndsAt: end,
                price: Number(sub.priceAmount),
            };
            const owner = sub.tenant.memberships[0]?.user ?? null;

            if (decision.markPastDue) {
                // The status move is the claim: only one run can take a
                // workshop from ACTIVE to PAST_DUE.
                const moved = await tx.tenant.updateMany({ where: { id: sub.tenantId, status: "ACTIVE" }, data: { status: "PAST_DUE" } });
                if (moved.count === 1) {
                    await tx.subscription.update({ where: { id: sub.id }, data: { overdueNoticeFor: end } });
                    await tx.platformAuditEvent.create({
                        data: {
                            actorUserId: null,
                            action: "PAST_DUE",
                            tenantId: sub.tenantId,
                            detail: { periodEndsAt: end.toISOString(), readOnlyFrom: readOnlyFrom(end, rules).toISOString(), reference: sub.reference },
                        },
                    });
                    readOnly.push({ line, owner });
                }
            } else if (decision.remind) {
                const claimed = await tx.subscription.updateMany({
                    where: { id: sub.id, OR: [{ remindedFor: null }, { remindedFor: { not: end } }] },
                    data: { remindedFor: end },
                });
                if (claimed.count === 1) reminders.push({ line, owner });
            }
        }

        return { checked: subs.length, reminders, readOnly };
    });

    // Letters after the commit. A failed send is logged and counted; it does
    // not undo the status, which is what the terms said would happen.
    let failedLetters = 0;
    const send = async (what: string, slug: string, fn: () => Promise<void>) => {
        try {
            await fn();
        } catch (error) {
            failedLetters += 1;
            console.error(`[renewals] ${what} could not be sent.`, { workshop: slug, error: error instanceof Error ? error.message : String(error) });
        }
    };

    for (const { line, owner } of reminders) {
        if (!owner) continue;
        await send("reminder", line.slug, () =>
            sendRenewalReminder({
                to: owner.email,
                firstName: owner.firstName,
                workshopName: line.workshopName,
                periodEndsAt: line.periodEndsAt,
                readOnlyFrom: readOnlyFrom(line.periodEndsAt, rules),
                price: line.price,
                reference: line.reference,
            }),
        );
    }
    for (const { line, owner } of readOnly) {
        if (!owner) continue;
        await send("read-only notice", line.slug, () =>
            sendReadOnlyNotice({
                to: owner.email,
                firstName: owner.firstName,
                workshopName: line.workshopName,
                periodEndsAt: line.periodEndsAt,
                price: line.price,
                reference: line.reference,
            }),
        );
    }
    await send("team digest", "-", () => sendTeamDigest({ reminded: reminders.map((r) => r.line), readOnly: readOnly.map((r) => r.line) }));

    return { checked, reminded: reminders.length, readOnly: readOnly.length, failedLetters };
}
