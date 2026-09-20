import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listKeys } from "@/lib/api/key-service";
import { ApiKeys } from "@/components/api/ApiKeys";
import { RATE_LIMIT } from "@/lib/api/keys";

export const metadata = { title: "API keys | MOTION Workshop Manager" };

/** Short enough to read standing up, and it is the whole API. */
const ENDPOINTS = [
    { call: "GET /api/v1/ping", says: "Whose workshop this key opens, and what it may do." },
    { call: "GET /api/v1/customers", says: "Customers, newest changes first with ?updatedSince=." },
    { call: "GET /api/v1/customers/{id}", says: "One customer with their vehicles." },
    { call: "GET /api/v1/vehicles?plate=N+123+W", says: "Find a car by its registration." },
    { call: "GET /api/v1/vehicles/{id}", says: "One vehicle and its last ten jobs." },
    { call: "GET /api/v1/products", says: "The price list and what is on the shelf." },
    { call: "GET /api/v1/documents", says: "Quotes, job cards, invoices and credits, with what is still owed." },
    { call: "GET /api/v1/documents/{id}", says: "One document with its lines." },
    { call: "GET /api/v1/bookings?slots={typeId}", says: "When somebody could come in." },
    { call: "POST /api/v1/bookings", says: "Ask for a booking. Needs a write key; staff confirm it." },
];

export default async function ApiSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    const keys = await listKeys(db);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">API keys</h3>
                <p className="text-sm text-slate-500">
                    For letting something outside MOTION read your workshop&rsquo;s data — your own website, a reporting tool, whoever you ask to build you something.
                    A key stands for the whole workshop, so treat it like the keys to the building.
                </p>
            </div>

            <ApiKeys tenant={slug} keys={keys} timezone={tenant.timezone} />

            <section className="rounded-sm border border-slate-200 bg-white">
                <h4 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What a key can call</h4>
                <ul className="divide-y divide-slate-100 text-sm">
                    {ENDPOINTS.map((e) => (
                        <li key={e.call} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2">
                            <code className="font-mono text-xs text-slate-700">{e.call}</code>
                            <span className="min-w-0 flex-1 text-xs text-slate-500">{e.says}</span>
                        </li>
                    ))}
                </ul>
                <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                    <p>Send the key as a header: <code className="font-mono text-slate-700">Authorization: Bearer mk_live_…</code></p>
                    <p>Answers are JSON. Lists page with <code className="font-mono text-slate-700">?limit=</code> and the <code className="font-mono text-slate-700">nextCursor</code> from the last answer. Money comes back as a string, so no cents go missing in rounding.</p>
                    <p>Up to {RATE_LIMIT.requests} requests a minute per key. Past that you get a 429 telling you how long to wait.</p>
                </div>
            </section>
        </div>
    );
}
