import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { recordOpen } from "@/lib/sharing/links";
import { inspectionForToken } from "@/lib/inspections/public";
import { CustomerApproval } from "@/components/inspections/CustomerApproval";

export const metadata: Metadata = { title: "Your inspection", robots: { index: false, follow: false }, referrer: "no-referrer" };

const REASONS = {
    unknown: "This link is not valid. It may have been copied incompletely.",
    expired: "This link has expired. Ask the workshop to send it again.",
    revoked: "This link has been withdrawn by the workshop.",
} as const;

/**
 * The page the customer lands on from WhatsApp. No account, no password: the
 * link is the credential, and it reaches this one inspection only.
 */
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const found = await inspectionForToken(token);
    if (!found.ok) {
        return (
            <main className="grid min-h-svh place-items-center bg-slate-100 p-6">
                <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center">
                    <h1 className="text-lg font-bold text-slate-800">Link unavailable</h1>
                    <p className="mt-2 text-slate-600">{REASONS[found.reason]}</p>
                </div>
            </main>
        );
    }
    const { inspection, tenant, share } = found;

    // The workshop sees when the customer first looked, and the link counts the open.
    await recordOpen(share.id);
    if (!inspection.customerViewedAt) {
        await prisma.inspection.update({ where: { id: inspection.id }, data: { customerViewedAt: new Date() } });
    }

    const photo = (id: string) => `/approve/${token}/photo/${id}`;
    const flagged = inspection.items.filter((i) => i.urgent || i.soon).sort((a, b) => Number(b.urgent) - Number(a.urgent));

    return (
        <CustomerApproval
            token={token}
            workshop={{ name: tenant.name, phone: tenant.phone ?? tenant.mobile }}
            vehicle={inspection.vehicle ? `${inspection.vehicle.make} ${inspection.vehicle.model} (${inspection.vehicle.plate})` : "vehicle"}
            currency={tenant.currency}
            closed={inspection.state === "FINALISED" || inspection.state === "DRAFT"}
            findings={flagged.map((i) => ({
                id: i.id,
                group: i.group,
                description: i.description,
                comment: i.comment,
                urgent: i.urgent,
                soon: i.soon,
                estimate: i.estimate,
                readings: i.inputLabels.map((label, n) => ({ label, value: i.inputs[n] ?? "" })).filter((r) => r.value),
                photos: i.photos.map((p) => photo(p.id)),
                answer: i.approvedAt ? "approve" : i.declinedAt ? "decline" : null,
                locked: !!i.documentLineId,
            }))}
            fine={inspection.items.filter((i) => i.checked && !i.urgent && !i.soon).map((i) => ({ group: i.group, description: i.description }))}
        />
    );
}
