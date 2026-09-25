import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { getStockTake } from "@/lib/stock/stocktake-service";
import { StockTakeSheet } from "@/components/products/StockTakeSheet";
import { dateShortIn } from "@/lib/format";
import { DownloadPair } from "@/components/exports/DownloadPair";

export const metadata = { title: "Counting | MOTION Workshop Manager" };

export default async function StockTakeDetailPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const take = await getStockTake(db, id);
    if (!take) notFound();
    const scope = take.scope as { location?: string; codeFrom?: string; codeTo?: string; includeZero?: boolean };
    const what = [scope.location && `shelf ${scope.location}`, scope.codeFrom && `codes from ${scope.codeFrom}`, scope.codeTo && `to ${scope.codeTo}`].filter(Boolean).join(", ");

    return (
        <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                <Link href={`/${slug}/dashboard/products/stock-take`} className="text-xs font-medium text-teal-700 hover:underline">← Stock takes</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">{take.number}</h1>
                <p className="text-sm text-slate-500">
                    {take.state === "APPLIED" ? `Applied ${dateShortIn(take.appliedAt, tenant.timezone)}${take.appliedBy ? ` by ${take.appliedBy.user.firstName}` : ""}` : take.state === "CANCELLED" ? "Cancelled" : "Counting"}
                    {" · "}started {dateShortIn(take.startedAt, tenant.timezone)}{take.startedBy ? ` by ${take.startedBy.user.firstName}` : ""}
                    {what ? ` · ${what}` : ""}{take.blind ? " · blind count" : ""}
                    {take.note ? ` · ${take.note}` : ""}
                </p>
                </div>
                <DownloadPair tenant={slug} report="stocktake" params={{ take: take.id }} />
            </div>
            <StockTakeSheet tenant={slug} take={take} currency={tenant.currency} />
        </div>
    );
}
