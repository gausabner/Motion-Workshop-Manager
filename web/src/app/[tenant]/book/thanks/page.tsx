import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";

export const metadata = { title: "Booking requested", robots: { index: false } };

export default async function ThanksPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ ref?: string }> }) {
    const [{ tenant: slug }, { ref }] = await Promise.all([params, searchParams]);
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { name: true, phone: true, isActive: true } });
    if (!tenant?.isActive) notFound();
    return (
        <main className="min-h-screen bg-slate-100 px-4 py-12">
            <div className="mx-auto max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
                <CheckCircle2 className="mx-auto h-12 w-12 text-teal-600" />
                <h1 className="text-xl font-bold text-slate-800">Request sent</h1>
                <p className="text-slate-600">{tenant.name} will confirm your booking — usually on WhatsApp. It is not booked until they do.</p>
                {ref && /^[A-Z0-9]{6}$/.test(ref) && <p className="text-sm text-slate-500">Your reference: <strong className="tabular-nums text-slate-700">{ref}</strong></p>}
                {tenant.phone && <p className="text-sm text-slate-500">Questions? <a href={`tel:${tenant.phone}`} className="font-semibold text-teal-700">{tenant.phone}</a></p>}
            </div>
        </main>
    );
}
