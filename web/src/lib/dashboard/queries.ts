import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import { businessToday } from "@/lib/tenant/today";
import { startOfMonth, toZoned } from "@/lib/diary/time";
import { marginReport } from "@/lib/stock/reports";
import { listReceivables } from "@/lib/payments/queries";
import { payablesReport } from "@/lib/purchasing/payments";
import { dueReminders } from "@/lib/reminders/queries";

/**
 * What an owner wants on opening the app: what came in today, what the month
 * has made, what is on the floor, and who owes whom. Every figure is derived
 * by the same code the detailed screens use, so the dashboard can never
 * disagree with the report behind it.
 */
export async function dashboardSummary(db: TenantDb, tenant: Tenant, now: Date = new Date()) {
    const today = businessToday(tenant.timezone, now);
    const day = toZoned(now, tenant.timezone).day;
    const monthStart = new Date(`${startOfMonth(day)}T00:00:00Z`);

    const [month, todayOnly, receivables, payables, reminders, jobs, bookings, unassigned, stock] = await Promise.all([
        marginReport(db, tenant, monthStart, today),
        marginReport(db, tenant, today, today),
        listReceivables(db, today),
        payablesReport(db, today),
        dueReminders(db, tenant, now),
        db.document.count({ where: { type: "JOB_CARD", state: "DRAFT" } }),
        db.document.count({ where: { type: "BOOKING", state: "DRAFT", scheduledAt: { gte: now } } }),
        db.document.count({ where: { type: "BOOKING", state: "DRAFT", scheduledAt: { gte: now }, mechanicId: null } }),
        db.product.findMany({ where: { archivedAt: null, isService: false, dontUpdateQty: false }, select: { qtyOnHand: true, costExTax: true } }),
    ]);

    return {
        today: { sales: todayOnly.totals.sales, profit: todayOnly.totals.profit },
        month: { sales: month.totals.sales, profit: month.totals.profit, percent: month.totals.percent, from: startOfMonth(day) },
        owedToUs: receivables.totals.total,
        overdue: round2(receivables.totals.total - receivables.totals.current),
        owedBySupplier: payables.total,
        remindersDue: reminders.items.length,
        openJobs: jobs,
        bookings,
        unassigned,
        stockValue: round2(stock.reduce((total, p) => total + p.qtyOnHand.toNumber() * p.costExTax.toNumber(), 0)),
    };
}

export type DashboardSummary = Awaited<ReturnType<typeof dashboardSummary>>;
