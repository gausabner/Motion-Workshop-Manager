import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { requisitionView } from "@/lib/requisitions/view";
import { RequisitionScreen } from "@/components/requisitions/RequisitionScreen";
import { tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("Requisition") };

export default async function RequisitionPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireFeature(slug, "requisitions");
    const view = await requisitionView(db, tenant, id, membership);
    if (!view) notFound();
    // What the screen offers to pick from: stock items, workshops and votes while it is written; the team when stores issues it.
    const [products, workshops, votes, people, suppliers] = await Promise.all([
        view.can.edit ? db.product.findMany({ where: { archivedAt: null, isService: false }, orderBy: { itemCode: "asc" }, take: 1000, select: { id: true, itemCode: true, description: true, costExTax: true, qtyOnHand: true } }) : [],
        view.can.edit ? db.workshop.findMany({ where: { archivedAt: null, kind: { not: "RECEPTION" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
        view.can.edit ? db.vote.findMany({ where: { archivedAt: null }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : [],
        view.can.issue ? db.membership.findMany({ where: { status: "ACTIVE" }, select: { id: true, payNumber: true, user: { select: { firstName: true, lastName: true } } } }) : [],
        view.can.quotes ? db.supplier.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" }, take: 500, select: { id: true, companyName: true, email: true } }) : [],
    ]);
    return (
        <RequisitionScreen
            tenant={slug}
            view={view}
            currency={tenant.currency}
            timezone={tenant.timezone}
            me={membership.id}
            options={{
                products: products.map((p) => ({ id: p.id, itemCode: p.itemCode, description: p.description, costExTax: p.costExTax.toNumber(), onHand: p.qtyOnHand.toNumber() })),
                workshops,
                votes: votes.map((v) => ({ id: v.id, label: `${v.code} · ${v.name}` })),
                people: people.map((p) => ({ id: p.id, name: fullName(p.user), payNumber: p.payNumber })).sort((a, b) => a.name.localeCompare(b.name)),
                suppliers: suppliers.map((s) => ({ id: s.id, name: s.companyName, email: s.email?.trim() || null })),
            }}
        />
    );
}
