import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MailOpen, Send } from "lucide-react";
import { DocumentEditor } from "@/components/documents/DocumentEditor";
import { DocumentToolbar } from "@/components/documents/DocumentToolbar";
import { DocumentFooterBar } from "@/components/documents/DocumentFooterBar";
import { ObjectHeader } from "@/components/layout/ObjectHeader";
import { Notice } from "@/components/ui/notice";
import { JobStatusPill, StatePill } from "@/components/documents/StatusPill";
import { requireTenant } from "@/lib/auth/session";
import { includes } from "@/lib/plans/features";
import { can } from "@/lib/auth/permissions";
import { getDocument, getEditorOptions } from "@/lib/documents/queries";
import { deliverySummary, listMessages } from "@/lib/messaging/queries";
import { MessageLog } from "@/components/messaging/MessageLog";
import { DocumentHistory } from "@/components/documents/DocumentHistory";
import { listAudit } from "@/lib/audit/queries";
import { JobTimePanel } from "@/components/time/JobTimePanel";
import { InspectionsPanel } from "@/components/inspections/InspectionsPanel";
import { loansForDocument } from "@/lib/loans/service";
import { LOAN_STATE_LABELS } from "@/lib/loans/rules";
import { inspectionsForDocument } from "@/lib/inspections/queries";
import { jobTime } from "@/lib/time/queries";
import { diaryMechanics } from "@/lib/diary/queries";
import { DOCUMENT_TYPE_LABELS, JOB_STATUS_LABELS } from "@/lib/documents/types";
import { dateShort, money } from "@/lib/format";
import { tabTitle } from "@/lib/copy/terms";
import { routeView } from "@/lib/fleet/queries";
import { JobRoutePanel } from "@/components/fleet/JobRoutePanel";
import { JobParts } from "@/components/requisitions/JobParts";
import { jobRequisitions } from "@/lib/requisitions/view";

/** The tab names the document and whose it is, so a row of open documents can be told apart. */
export async function generateMetadata({ params }: { params: Promise<{ tenant: string; id: string }> }): Promise<Metadata> {
    const { tenant: slug, id } = await params;
    const { db } = await requireTenant(slug);
    const doc = await db.document.findUnique({
        where: { id },
        select: { type: true, number: true, jobNumber: true, customer: { select: { firstName: true, lastName: true } } },
    });
    if (!doc) return { title: tabTitle("Document") };
    const name = doc.number ?? (doc.jobNumber ? `Job ${doc.jobNumber}` : `Draft ${DOCUMENT_TYPE_LABELS[doc.type].toLowerCase()}`);
    return { title: tabTitle(name, doc.customer ? `${doc.customer.firstName} ${doc.customer.lastName}`.trim() : null) };
}

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ processed?: string; short?: string; serials?: string }> }) {
    const [{ tenant: slug, id }, { processed, short, serials }] = await Promise.all([params, searchParams]);
    const { db, tenant, membership, plan } = await requireTenant(slug);
    const [doc, options, messages, time, mechanics, inspections, templates] = await Promise.all([
        getDocument(db, id), getEditorOptions(db), listMessages(db, { documentId: id }), jobTime(db, id), diaryMechanics(db), inspectionsForDocument(db, id),
        db.inspectionTemplate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    ]);
    const loans = await loansForDocument(db, id);
    if (!doc) notFound();

    // Fetched after the document exists, so a bad id 404s rather than reading
    // an audit trail for something that is not there.
    // A council job's route through reception, the check bay and the workshops, and its signatures.
    const route = includes(plan, "jobFlow") && doc.jobNumber ? await routeView(db, tenant, id, membership.id) : null;
    // A council job's history includes its route: every handover and signature, beside the edits.
    const history = can(membership, "reports:view")
        ? route
            ? [...(await listAudit(db, "Document", id)), ...(await listAudit(db, "JobRoute", id)).map((r) => ({ ...r, action: `ROUTE_${r.action}` }))]
                  .sort((a, b) => b.at.getTime() - a.at.getTime())
                  .slice(0, 50)
            : await listAudit(db, "Document", id)
        : [];
    // A job's requisitions for parts, on councils that requisition.
    const parts = includes(plan, "requisitions") && doc.jobNumber ? await jobRequisitions(db, id) : null;
    // Where the vehicle is, which on a council job is its status: the job status pill
    // would say "Booked in" all the way to collection.
    const here = route?.visits.find((v) => !v.leftAt) ?? null;
    const place = route ? (route.collected ? "Collected" : !here ? "Not booked in" : here.receivedAt ? `At ${here.place}` : `On its way to ${here.place}`) : null;

    const showCost = can(membership, "documents:see_cost");
    const base = `/${slug}/dashboard`;

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-16">
            <ObjectHeader
                icon={<FileText className="mt-0.5 h-6 w-6 shrink-0 text-slate-400" aria-hidden="true" />}
                title={<>{DOCUMENT_TYPE_LABELS[doc.type]} {doc.number ?? (doc.jobNumber ? `· ${doc.jobNumber}` : "")}</>}
                status={
                    <>
                        <StatePill state={doc.state} type={doc.type} />
                        {place && <span className="text-sm font-medium text-slate-700">{place}</span>}
                        {/* On a council job the place says booked in, inspecting or in progress already; a status that adds something still shows. */}
                        {doc.jobStatus && (!place || !["BOOKED_IN", "INSPECTION_IN_PROGRESS", "WORK_IN_PROGRESS"].includes(doc.jobStatus)) && <JobStatusPill status={doc.jobStatus} />}
                    </>
                }
                actions={<DocumentToolbar tenant={slug} doc={doc} currency={tenant.currency} canProcess={can(membership, "documents:process")} canVoid={can(membership, "documents:void")} canTakePayment={can(membership, "payments:take")} canSend={can(membership, "messages:send")} fleet={!!route} />}
                facts={[
                    {
                        label: "Customer",
                        value: doc.customer ? (
                            <Link href={`${base}/customers/${doc.customer.id}`} className="text-teal-700 hover:underline">{doc.customer.firstName} {doc.customer.lastName}</Link>
                        ) : "Cash sale",
                    },
                    ...(doc.vehicle
                        ? [{
                            label: "Vehicle",
                            value: (
                                <Link href={`${base}/vehicles/${doc.vehicle.id}`} className="inline-flex items-center gap-1.5 text-slate-800 hover:text-teal-700">
                                    <span className="rounded-sm bg-yellow-100 px-1 text-xs font-bold text-yellow-900">{doc.vehicle.plate}</span>
                                    <span className="truncate">{doc.vehicle.make} {doc.vehicle.model}</span>
                                </Link>
                            ),
                        }]
                        : []),
                    { label: "Date", value: dateShort(doc.postDate) },
                    ...(doc.sourceDocument
                        ? [{ label: "From", value: <Link href={`${base}/documents/${doc.sourceDocument.id}`} className="text-teal-700 hover:underline">{DOCUMENT_TYPE_LABELS[doc.sourceDocument.type]} {doc.sourceDocument.number ?? ""}</Link> }]
                        : []),
                    { label: "Total", value: money(doc.total), figure: true },
                    ...(doc.state !== "DRAFT" && doc.amountPaid > 0 ? [{ label: "Paid", value: money(doc.amountPaid), figure: true }] : []),
                    ...(doc.state !== "DRAFT" && (doc.type === "INVOICE" || doc.type === "CASH_SALE") ? [{ label: "Due", value: money(doc.amountDue), figure: true }] : []),
                ]}
            />

            <DeliveryStrip messages={messages} />

            {route && <JobRoutePanel tenant={slug} documentId={id} route={route} timezone={tenant.timezone} />}

            {parts && <JobParts tenant={slug} documentId={id} rows={parts} canRaise={can(membership, "requisitions:raise") && doc.state === "DRAFT"} />}

            {processed && (
                <Notice role="status">
                    Processed as <strong>{doc.number}</strong>. The lines are locked; raise a credit note if it needs to change.
                </Notice>
            )}
            {short && (
                <Notice tone="caution">
                    Stock on hand has gone negative on <strong>{short.split(",").join(", ")}</strong>. Either it was never booked in, or the count is wrong — check it on the product.
                </Notice>
            )}
            {loans.length > 0 && (
                <section className="rounded-sm border border-slate-200 bg-white text-sm">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Courtesy car</h2>
                    <ul className="divide-y divide-slate-100">
                        {loans.map((loan) => (
                            <li key={loan.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                                <Link href={`/${slug}/dashboard/loan-cars`} className="font-medium text-slate-800 hover:text-teal-700">{loan.vehicle.plate}</Link>
                                <span className="text-slate-500">{[loan.vehicle.make, loan.vehicle.model].filter(Boolean).join(" ")}</span>
                                <span className="text-slate-500">
                                    {LOAN_STATE_LABELS[loan.state]}
                                    {loan.inAt ? ` on ${dateShort(loan.inAt)}` : `, due back ${dateShort(loan.dueBackAt)}`}
                                </span>
                                {loan.odometerOut !== null && (
                                    <span className="text-xs text-slate-500">
                                        {loan.odometerIn !== null
                                            ? `${(loan.odometerIn - loan.odometerOut).toLocaleString("en-NA")} km on it`
                                            : `out on ${loan.odometerOut.toLocaleString("en-NA")} km`}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {(doc.splitFrom || doc.splits.length > 0 || doc.reworkOf || doc.reworks.length > 0) && (
                <section className="rounded-sm border border-slate-200 bg-white text-sm">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Related</h2>
                    <ul className="divide-y divide-slate-100">
                        {doc.splitFrom && (
                            <li className="px-4 py-2">
                                Split off <Link href={`/${slug}/dashboard/documents/${doc.splitFrom.id}`} className="font-medium text-slate-800 hover:text-teal-700">{doc.splitFrom.number ?? doc.splitFrom.jobNumber}</Link>
                                {doc.splitFrom.customer && <span className="text-slate-500"> · the other half is billed to {doc.splitFrom.customer.firstName} {doc.splitFrom.customer.lastName}</span>}
                            </li>
                        )}
                        {doc.splits.map((split) => (
                            <li key={split.id} className="px-4 py-2">
                                Split to <Link href={`/${slug}/dashboard/documents/${split.id}`} className="font-medium text-slate-800 hover:text-teal-700">{split.number ?? "a draft invoice"}</Link>
                                {split.customer && <span className="text-slate-500"> for {split.customer.firstName} {split.customer.lastName}</span>}
                                <span className="text-slate-500"> · {money(Number(split.total), tenant.currency)}</span>
                            </li>
                        ))}
                        {doc.reworkOf && (
                            <li className="px-4 py-2">
                                Rework of <Link href={`/${slug}/dashboard/documents/${doc.reworkOf.id}`} className="font-medium text-slate-800 hover:text-teal-700">{doc.reworkOf.jobNumber ?? doc.reworkOf.number}</Link>
                                <span className="text-slate-500"> from {dateShort(doc.reworkOf.postDate)}{doc.reworkReason ? ` — ${doc.reworkReason}` : ""}</span>
                            </li>
                        )}
                        {doc.reworks.map((rework) => (
                            <li key={rework.id} className="px-4 py-2">
                                Reworked on <Link href={`/${slug}/dashboard/documents/${rework.id}`} className="font-medium text-slate-800 hover:text-teal-700">{rework.jobNumber ?? rework.number}</Link>
                                <span className="text-slate-500">{rework.reworkReason ? ` — ${rework.reworkReason}` : ""}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {serials && (
                <p className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    {serials} The sale went through; put the serial right on the product so the warranty can be traced.
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
                showCost={showCost}
                timeZone={tenant.timezone}
            />

            {(doc.type === "BOOKING" || doc.type === "JOB_CARD") && (
                // Inspections are a Full workshop feature: on a plan without them the
                // panel only appears to show ones done before, and cannot start one.
                (includes(plan, "inspections") || inspections.length > 0) && (
                    <InspectionsPanel
                        tenant={slug}
                        documentId={doc.id}
                        rows={inspections}
                        canStart={includes(plan, "inspections") && can(membership, "documents:write") && doc.state !== "VOID"}
                        templates={templates}
                    />
                )
            )}

            {(doc.type === "BOOKING" || doc.type === "JOB_CARD") && (
                <JobTimePanel tenant={slug} documentId={doc.id} time={time} mechanics={mechanics} canEdit={can(membership, "documents:write")} />
            )}

            <MessageLog tenant={slug} rows={messages} showSubject={false} empty="Nothing sent about this document yet. Use Send to share it on WhatsApp or by email." />

            {/* Shown to people who may see reports, which is the same group
                trusted with money figures. A mechanic editing a job card does
                not need to know who else has touched it; an owner settling an
                argument about an invoice does. */}
            {can(membership, "reports:view") && <DocumentHistory rows={history} timezone={tenant.timezone} />}

            {doc.statusEvents.length > 0 && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status history</h2>
                    <ol className="divide-y divide-slate-100">
                        {doc.statusEvents.map((e) => (
                            <li key={e.id} className="px-4 py-2 text-sm flex items-center justify-between gap-4">
                                <span>
                                    {e.fromStatus ? `${JOB_STATUS_LABELS[e.fromStatus]} → ` : ""}
                                    <strong className="font-medium">{JOB_STATUS_LABELS[e.toStatus]}</strong>
                                    {e.comment && <span className="text-slate-500"> — {e.comment}</span>}
                                </span>
                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                    {e.by ? `${e.by.user.firstName} ${e.by.user.lastName} · ` : ""}{dateShort(e.at)}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {doc.state === "DRAFT" && <DocumentFooterBar tenant={slug} doc={doc} canProcess={can(membership, "documents:process")} showProcess={!route} />}
        </div>
    );
}

const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Windhoek" });

/** The one line a counter wants when the customer phones: did we send it, and did they look. */
function DeliveryStrip({ messages }: { messages: Awaited<ReturnType<typeof listMessages>> }) {
    const { latest, opened, count } = deliverySummary(messages);
    if (!latest) return null;
    const channel = latest.channel === "WHATSAPP" ? "WhatsApp" : latest.channel === "EMAIL" ? "email" : "SMS";
    return (
        <Notice icon={opened ? MailOpen : Send}>
            {latest.status === "HANDED_OFF" ? `Handed to ${channel}` : `Sent by ${channel}`} {when(latest.createdAt)}
            {count > 1 ? ` (${count} times)` : ""}
            {opened ? <> · <strong>opened by the customer {when(opened)}</strong></> : " · not opened yet"}
        </Notice>
    );
}
