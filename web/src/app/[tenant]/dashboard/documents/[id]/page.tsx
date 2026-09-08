import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Car, User } from "lucide-react";
import { DocumentEditor } from "@/components/documents/DocumentEditor";
import { DocumentToolbar } from "@/components/documents/DocumentToolbar";
import { JobStatusPill, StatePill } from "@/components/documents/StatusPill";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getDocument, getEditorOptions } from "@/lib/documents/queries";
import { DOCUMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/lib/documents/types";
import { dateShort, money } from "@/lib/format";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ processed?: string }> }) {
    const [{ tenant: slug, id }, { processed }] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    const [doc, options] = await Promise.all([getDocument(db, id), getEditorOptions(db)]);
    if (!doc) notFound();

    const showCost = can(membership, "documents:see_cost");
    const base = `/${slug}/dashboard`;

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-16">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <FileText className="w-6 h-6 text-slate-400 mt-0.5" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-tight flex items-center gap-3 flex-wrap">
                            {DOCUMENT_TYPE_LABELS[doc.type]} {doc.number ?? (doc.jobNumber ? `· ${doc.jobNumber}` : "")}
                            <StatePill state={doc.state} />
                            {doc.jobStatus && <JobStatusPill status={doc.jobStatus} />}
                        </h1>
                        <p className="text-xs text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                            {doc.customer ? (
                                <Link href={`${base}/customers/${doc.customer.id}`} className="hover:text-teal-700 flex items-center gap-1"><User className="w-3 h-3" />{doc.customer.firstName} {doc.customer.lastName}</Link>
                            ) : <span>Cash sale</span>}
                            {doc.vehicle && (
                                <Link href={`${base}/vehicles/${doc.vehicle.id}`} className="hover:text-teal-700 flex items-center gap-1"><Car className="w-3 h-3" />{doc.vehicle.plate} · {doc.vehicle.make} {doc.vehicle.model}</Link>
                            )}
                            <span>{dateShort(doc.postDate)}</span>
                            {doc.state === "PROCESSED" && <span className="font-semibold text-slate-700">{money(doc.total)}</span>}
                            {doc.sourceDocument && (
                                <Link href={`${base}/documents/${doc.sourceDocument.id}`} className="hover:text-teal-700">from {DOCUMENT_TYPE_LABELS[doc.sourceDocument.type].toLowerCase()} {doc.sourceDocument.number ?? ""}</Link>
                            )}
                        </p>
                    </div>
                </div>
                <DocumentToolbar tenant={slug} doc={doc} canProcess={can(membership, "documents:process")} canVoid={can(membership, "documents:void")} />
            </div>

            {processed && (
                <p className="rounded-sm border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
                    Processed as <strong>{doc.number}</strong>. The lines are locked; raise a credit note if it needs to change.
                </p>
            )}
            {doc.state === "VOID" && (
                <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
                    Voided {dateShort(doc.voidedAt)}{doc.voidReason ? ` — ${doc.voidReason}` : ""}.
                </p>
            )}
            {doc.derivedDocuments.length > 0 && (
                <p className="text-xs text-slate-500">
                    Led to:{" "}
                    {doc.derivedDocuments.map((d, i) => (
                        <span key={d.id}>
                            {i > 0 && ", "}
                            <Link href={`${base}/documents/${d.id}`} className="text-teal-700 hover:underline">{DOCUMENT_TYPE_LABELS[d.type].toLowerCase()} {d.number ?? "(draft)"}</Link>
                        </span>
                    ))}
                </p>
            )}

            <DocumentEditor
                tenant={slug}
                doc={doc}
                options={options}
                pricesIncludeTax={tenant.pricesIncludeTax}
                salesTaxRate={tenant.salesTaxRate.toNumber()}
                showCost={showCost}
            />

            {doc.statusEvents.length > 0 && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status history</h3>
                    <ol className="divide-y divide-slate-100">
                        {doc.statusEvents.map((e) => (
                            <li key={e.id} className="px-4 py-2 text-sm flex items-center justify-between gap-4">
                                <span>
                                    {e.fromStatus ? `${JOB_STATUS_LABELS[e.fromStatus]} → ` : ""}
                                    <strong className="font-medium">{JOB_STATUS_LABELS[e.toStatus]}</strong>
                                    {e.comment && <span className="text-slate-500"> — {e.comment}</span>}
                                </span>
                                <span className="text-xs text-slate-400 whitespace-nowrap">
                                    {e.by ? `${e.by.user.firstName} ${e.by.user.lastName} · ` : ""}{dateShort(e.at)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </div>
    );
}
