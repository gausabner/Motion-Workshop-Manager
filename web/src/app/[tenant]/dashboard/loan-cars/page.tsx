import { CarFront } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { loanFleet } from "@/lib/loans/service";
import { LoanFleet } from "@/components/loans/LoanFleet";
import { toZoned } from "@/lib/diary/time";

export const metadata = { title: "Courtesy cars | MOTION Workshop Manager" };

export default async function LoanCarsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "documents:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="create or edit documents" />;
    const [fleet, customers, jobs] = await Promise.all([
        loanFleet(db),
        db.customer.findMany({ where: { archivedAt: null }, orderBy: [{ lastName: "asc" }], take: 300, select: { id: true, firstName: true, lastName: true } }),
        db.document.findMany({
            where: { type: { in: ["JOB_CARD", "BOOKING"] }, state: "DRAFT" },
            orderBy: { createdAt: "desc" }, take: 100,
            select: { id: true, jobNumber: true, number: true, customerId: true, customer: { select: { firstName: true, lastName: true } }, vehicle: { select: { plate: true } } },
        }),
    ]);

    return (
        <div className="max-w-5xl space-y-4">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><CarFront className="h-6 w-6 text-slate-400" />Courtesy cars</h1>
                <p className="text-sm text-slate-500">Which car is free, who has which, and what should have been back by now.</p>
            </div>
            <LoanFleet
                tenant={slug} fleet={fleet} timezone={tenant.timezone} today={toZoned(new Date(), tenant.timezone).day}
                customers={customers.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim() }))}
                jobs={jobs.map((j) => ({
                    id: j.id, customerId: j.customerId,
                    label: [j.jobNumber ?? j.number, j.customer ? `${j.customer.firstName} ${j.customer.lastName}`.trim() : null, j.vehicle?.plate].filter(Boolean).join(" · "),
                }))}
            />
        </div>
    );
}
