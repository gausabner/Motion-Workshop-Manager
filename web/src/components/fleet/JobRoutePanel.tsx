"use client";

import { Button } from "@/components/ui/button";
import { acceptAction, bookInAction, sendOnAction, signJobAction } from "@/lib/fleet/actions";
import type { RouteView } from "@/lib/fleet/queries";
import { PURPOSE_LABEL, ROLE_LABEL } from "@/lib/fleet/route-rules";
import { duration } from "@/lib/fleet/format";
import { Outcome, Panel, field, useAction } from "@/components/settings/council/shared";

/**
 * The job's route and its signatures, on the job card. The route reads top to
 * bottom like the paper card's history: each stay, who handed the vehicle
 * over and who received it, and how long it was there. Only the moves and
 * signatures the person looking may make are offered.
 */

export function JobRoutePanel({ tenant, documentId, route, timezone }: { tenant: string; documentId: string; route: RouteView; timezone: string }) {
    const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const current = route.visits.find((v) => !v.leftAt) ?? null;
    const status = route.collected
        ? "Collected"
        : !current
          ? "Not booked in"
          : current.receivedAt
            ? `At ${current.place}${current.minutes !== null ? ` · ${duration(current.minutes)}` : ""}`
            : `On its way to ${current.place}`;

    return (
        // Side by side on a wide screen, so the job card's own panels below keep their place.
        <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel wide title="Route" action={<span className="text-xs font-medium text-slate-700">{status}</span>}>
                {route.visits.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Not booked in yet. Reception books the vehicle in when the driver brings it.</p>
                ) : (
                    <ol className="divide-y divide-slate-100">
                        {route.visits.map((v) => (
                            <li key={v.id} className="relative px-4 py-2.5 text-sm">
                                {v === current && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-teal-700" />}
                                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                    <p className="font-medium text-slate-900">
                                        {v.place} <span className="font-normal text-slate-500">· {PURPOSE_LABEL[v.purpose]}</span>
                                    </p>
                                    {v.minutes !== null && <span className="tabular-nums text-xs text-slate-500">{duration(v.minutes)}{v.leftAt ? "" : " so far"}</span>}
                                </div>
                                <p className="text-xs text-slate-500">
                                    {v.purpose === "INTAKE" ? `Booked in by ${v.sentBy ?? "—"}, ${when(v.sentAt)}` : `Sent by ${v.sentBy ?? "—"}, ${when(v.sentAt)}`}
                                    {v.purpose !== "INTAKE" && (v.receivedAt ? ` · received by ${v.receivedBy ?? "—"}, ${when(v.receivedAt)}` : " · on its way")}
                                </p>
                                {v.note && <p className="mt-0.5 text-xs text-slate-700">{v.note}</p>}
                            </li>
                        ))}
                    </ol>
                )}
                <RouteActions tenant={tenant} documentId={documentId} route={route} current={current} />
            </Panel>
            <SignaturesPanel tenant={tenant} documentId={documentId} route={route} when={when} />
        </div>
    );
}

function RouteActions({ tenant, documentId, route, current }: { tenant: string; documentId: string; route: RouteView; current: RouteView["visits"][number] | null }) {
    const [bookState, book, booking] = useAction(bookInAction.bind(null, tenant, documentId));
    const [sendState, send, sending] = useAction(sendOnAction.bind(null, tenant, documentId));
    const [acceptState, accept, accepting] = useAction((_prev, formData: FormData) => acceptAction(tenant, documentId, String(formData.get("visitId"))));
    const { can } = route;
    if (!can.bookIn.length && !can.accept && !can.send.length && !can.blocked) return null;
    return (
        <div className="space-y-2 border-t border-slate-200 px-4 py-3">
            {can.bookIn.length > 0 && (
                <form action={book} className="flex flex-wrap items-center gap-2">
                    <select name="workshopId" defaultValue={can.bookIn[0].id} aria-label="Reception" className={field}>
                        {can.bookIn.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" disabled={booking}>{booking ? "Booking in…" : "Book in"}</Button>
                    <Outcome state={bookState} />
                </form>
            )}
            {can.accept && current && (
                <form action={accept} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="visitId" value={can.accept} />
                    <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" disabled={accepting}>{accepting ? "Accepting…" : `Accept it at ${current.place}`}</Button>
                    <Outcome state={acceptState} />
                </form>
            )}
            {can.send.length > 0 && (
                <form action={send} className="flex flex-wrap items-center gap-2">
                    <select name="to" required defaultValue="" aria-label="Where it goes" className={`${field} min-w-0`}>
                        <option value="" disabled>Send it to</option>
                        {can.send.map((group) => (
                            <optgroup key={group.purpose} label={PURPOSE_LABEL[group.purpose]}>
                                {group.places.map((p) => <option key={p.id} value={`${group.purpose}:${p.id}`}>{p.name}</option>)}
                            </optgroup>
                        ))}
                    </select>
                    <input name="note" placeholder="Note for the next place (optional)" aria-label="Note" maxLength={200} className={`${field} w-64 min-w-0`} />
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={sending}>{sending ? "Sending…" : "Send it on"}</Button>
                    <Outcome state={sendState} />
                </form>
            )}
            {can.blocked && <p className="text-xs text-slate-600">{can.blocked}</p>}
        </div>
    );
}

function SignaturesPanel({ tenant, documentId, route, when }: { tenant: string; documentId: string; route: RouteView; when: (iso: string) => string }) {
    const at = (stage: string) => route.signatures.filter((s) => s.stage === stage);
    const cols = (
        <colgroup>
            <col className="w-28" />
            <col />
            <col className="w-24" />
            <col className="w-24" />
        </colgroup>
    );
    const issue = at("ISSUE");
    const rows = (list: RouteView["signatures"]) =>
        list.map((s) => (
            <tr key={s.id} className="border-t border-slate-100 align-baseline">
                <td className="py-1.5 pr-3 text-slate-500">{ROLE_LABEL[s.role]}</td>
                <td className="py-1.5 pr-3 font-medium text-slate-900">
                    {s.name}
                    {(s.decision !== "SIGNED" || s.comment) && (
                        <span className="block text-xs font-normal text-slate-600">
                            {s.decision === "PASSED" && <span className="font-semibold text-teal-700">Passed</span>}
                            {s.decision === "FAILED" && <span className="font-semibold text-red-700">Failed</span>}
                            {s.decision !== "SIGNED" && s.comment && " · "}
                            {s.comment}
                        </span>
                    )}
                </td>
                <td className="py-1.5 pr-3 tabular-nums text-slate-600">{s.payNumber ?? "—"}</td>
                <td className="py-1.5 text-right tabular-nums text-xs text-slate-500">{when(s.at)}</td>
            </tr>
        ));
    return (
        <Panel wide title="Job card signatures" footer="Each signature keeps the name and pay number as they stood when it was given. A driver without a login is recorded by reception and signs the printed card.">
            <div className="space-y-4 px-4 py-3">
                <section>
                    <h4 className="text-xs font-semibold text-slate-900">At issue</h4>
                    <table className="mt-1 w-full table-fixed text-sm">
                        {cols}
                        <tbody>
                            {rows(issue)}
                            {route.issueMissing.map((role) => (
                                <tr key={role} className="border-t border-slate-100">
                                    <td className="py-1.5 pr-3 text-slate-500">{ROLE_LABEL[role]}</td>
                                    <td colSpan={3} className="py-1.5 text-slate-500">Waiting</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
                {(["ASSESSMENT", "QUALITY_CHECK", "COLLECTION"] as const).map((stage) =>
                    at(stage).length > 0 ? (
                        <section key={stage}>
                            <h4 className="text-xs font-semibold text-slate-900">{stage === "ASSESSMENT" ? "Assessment" : stage === "QUALITY_CHECK" ? "Quality check" : "Collection"}</h4>
                            <table className="mt-1 w-full table-fixed text-sm">{cols}<tbody>{rows(at(stage))}</tbody></table>
                        </section>
                    ) : null,
                )}
                {route.can.sign.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-3">
                        {route.can.sign.map((box) => <SignBox key={`${box.stage}-${box.role}`} tenant={tenant} documentId={documentId} box={box} />)}
                    </div>
                )}
            </div>
        </Panel>
    );
}

function SignBox({ tenant, documentId, box }: { tenant: string; documentId: string; box: RouteView["can"]["sign"][number] }) {
    const [state, action, signing] = useAction(signJobAction.bind(null, tenant, documentId));
    const label = box.role === "DRIVER" ? "Record the driver's signature" : `Sign as ${ROLE_LABEL[box.role].toLowerCase()}`;
    return (
        <form action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="stage" value={box.stage} />
            <input type="hidden" name="role" value={box.role} />
            <span className="w-28 shrink-0 text-xs text-slate-500">{box.stage === "ISSUE" ? "At issue" : box.stage === "ASSESSMENT" ? "Assessment" : box.stage === "QUALITY_CHECK" ? "Quality check" : "Collection"}</span>
            {box.role === "DRIVER" && (
                <>
                    <input name="driverName" required placeholder="Driver's name" aria-label="Driver's name" className={`${field} w-48`} />
                    <input name="driverPayNumber" placeholder="Pay No." aria-label="Driver's pay number" className={`${field} w-28 tabular-nums`} />
                </>
            )}
            {box.stage === "QUALITY_CHECK" && (
                <fieldset className="flex items-center gap-3 text-sm text-slate-700">
                    <legend className="sr-only">Outcome</legend>
                    <label className="inline-flex items-center gap-1.5"><input type="radio" name="decision" value="PASSED" required className="accent-teal-700" />Passed</label>
                    <label className="inline-flex items-center gap-1.5"><input type="radio" name="decision" value="FAILED" className="accent-teal-700" />Failed</label>
                </fieldset>
            )}
            {(box.stage === "ASSESSMENT" || box.stage === "QUALITY_CHECK") && (
                <input name="comment" placeholder={box.stage === "ASSESSMENT" ? "What it needs" : "What failed, if it did"} aria-label={box.stage === "ASSESSMENT" ? "Assessment findings" : "Quality check findings"} maxLength={300} className={`${field} w-64 min-w-0`} />
            )}
            <Button type="submit" size="sm" variant="outline" className="h-8" disabled={signing}>{signing ? "Signing…" : label}</Button>
            <Outcome state={state} />
        </form>
    );
}
