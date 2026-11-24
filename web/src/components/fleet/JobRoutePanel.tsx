"use client";

import { createContext, useActionState, useCallback, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { acceptAction, bookInAction, sendOnAction, signJobAction, startCheckAction } from "@/lib/fleet/actions";
import type { MoveState, RouteView } from "@/lib/fleet/queries";
import { PURPOSE_LABEL, ROLE_LABEL } from "@/lib/fleet/route-rules";
import { duration } from "@/lib/fleet/format";
import { Outcome, Panel, field } from "@/components/settings/council/shared";

/**
 * The job's route and its signatures, on the job card. The route reads top to
 * bottom like the paper card's history: each stay, who handed the vehicle
 * over and who received it, and how long it was there. Only the moves and
 * signatures the person looking may make are offered.
 */

/** Hands a move's answer — the route as it now stands — back to the panel. */
const ShowRoute = createContext<(route: RouteView) => void>(() => {});

/** `useActionState` for a move: when it answers with the route, the panel shows it. */
function useRouteMove(run: (prev: MoveState, formData: FormData) => Promise<MoveState>) {
    const show = useContext(ShowRoute);
    const result = useActionState(run, {} as MoveState);
    const [state] = result;
    useEffect(() => {
        if (state.route) show(state.route);
    }, [state, show]);
    return result;
}

export function JobRoutePanel({ tenant, documentId, route: given, timezone }: { tenant: string; documentId: string; route: RouteView; timezone: string }) {
    // The route the page was rendered with, until a move answers with a newer
    // one; a fresh render of the page replaces both.
    const [shown, setShown] = useState({ given, route: given });
    if (shown.given !== given) setShown({ given, route: given });
    const route = shown.given === given ? shown.route : given;
    const show = useCallback((next: RouteView) => setShown((s) => ({ ...s, route: next })), []);
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
        <ShowRoute.Provider value={show}>
            {/* Side by side on a wide screen, so the job card's own panels below keep their place. */}
            <div className="grid items-start gap-4 xl:grid-cols-2">
                <Panel wide level={2} title="Route" action={<span role="status" className="text-xs font-medium text-slate-700">{status}</span>}>
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
        </ShowRoute.Provider>
    );
}

/*
 * Each move is its own component with its own action state, keyed by the stay
 * it acts on, so a move that succeeds takes its form, its message and its
 * pending state away with it and the next stay starts clean. Every move answers
 * with the route as it now stands (`useRouteMove`).
 */
function RouteActions({ tenant, documentId, route, current }: { tenant: string; documentId: string; route: RouteView; current: RouteView["visits"][number] | null }) {
    const { can } = route;
    if (!can.bookIn.length && !can.accept && !can.send.length && !can.blocked) return null;
    return (
        <div className="space-y-2 border-t border-slate-200 px-4 py-3">
            {can.bookIn.length > 0 && <BookInForm tenant={tenant} documentId={documentId} places={can.bookIn} />}
            {can.accept && current && <AcceptForm key={can.accept} tenant={tenant} documentId={documentId} visitId={can.accept} place={current.place} />}
            {can.send.length > 0 && <SendForm key={current?.id ?? "none"} tenant={tenant} documentId={documentId} groups={can.send} />}
            {can.blocked && <p className="text-xs text-slate-600">{can.blocked}</p>}
        </div>
    );
}

function BookInForm({ tenant, documentId, places }: { tenant: string; documentId: string; places: RouteView["can"]["bookIn"] }) {
    const [state, action, pending] = useRouteMove(bookInAction.bind(null, tenant, documentId));
    return (
        <form action={action} className="flex flex-wrap items-center gap-2">
            <select name="workshopId" defaultValue={places[0].id} aria-label="Reception" className={field}>
                {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button type="submit" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Booking in…" : "Book in"}</Button>
            <Outcome state={state} />
        </form>
    );
}

function AcceptForm({ tenant, documentId, visitId, place }: { tenant: string; documentId: string; visitId: string; place: string }) {
    const [state, action, pending] = useRouteMove(() => acceptAction(tenant, documentId, visitId));
    return (
        <form action={action} className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Accepting…" : `Accept it at ${place}`}</Button>
            <Outcome state={state} />
        </form>
    );
}

function SendForm({ tenant, documentId, groups }: { tenant: string; documentId: string; groups: RouteView["can"]["send"] }) {
    const [state, action, pending] = useRouteMove(sendOnAction.bind(null, tenant, documentId));
    return (
        <form action={action} className="flex flex-wrap items-center gap-2">
            <select name="to" required defaultValue="" aria-label="Where it goes" className={`${field} min-w-0 ${touch}`}>
                <option value="" disabled>Send it to</option>
                {groups.map((group) => (
                    <optgroup key={group.purpose} label={PURPOSE_LABEL[group.purpose]}>
                        {group.places.map((p) => <option key={p.id} value={`${group.purpose}:${p.id}`}>{p.name}</option>)}
                    </optgroup>
                ))}
            </select>
            <input name="note" placeholder="Note for the next place (optional)" aria-label="Note" maxLength={200} className={`${field} w-64 min-w-0`} />
            <Button type="submit" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={pending}>{pending ? "Sending…" : "Send it on"}</Button>
            <Outcome state={state} />
        </form>
    );
}

const STAGES = ["ISSUE", "ASSESSMENT", "QUALITY_CHECK", "COLLECTION"] as const;
const STAGE_LABEL: Record<(typeof STAGES)[number], string> = { ISSUE: "At issue", ASSESSMENT: "Assessment", QUALITY_CHECK: "Quality check", COLLECTION: "Collection" };
/** Touch-sized on a coarse pointer: a foreman at a shared tablet, gloves off or not. */
const touch = "pointer-coarse:min-h-11";

/**
 * The job card's signatures, laid out like the paper card: each stage's
 * boxes, signed or waiting. A box this person may sign carries its own
 * button, named for whose signature it records. One person signs one box at
 * issue (reception also records the driver), and the rule refuses a second.
 */
function SignaturesPanel({ tenant, documentId, route, when }: { tenant: string; documentId: string; route: RouteView; when: (iso: string) => string }) {
    const mine = (stage: string, role: string) => route.can.sign.some((b) => b.stage === stage && b.role === role);
    const issueOffered = route.can.sign.filter((b) => b.stage === "ISSUE" && b.role !== "DRIVER").length;
    return (
        <Panel wide level={2} title="Job card signatures" footer="Each signature keeps the name and pay number as they stood when it was given. A driver without a login is recorded by reception and signs the printed card.">
            <div className="space-y-4 px-4 py-3">
                {STAGES.filter((stage) => route.signatures.some((s) => s.stage === stage) || route.waiting.some((w) => w.stage === stage)).map((stage, n) => {
                    const signed = route.signatures.filter((s) => s.stage === stage);
                    const waiting = route.waiting.filter((w) => w.stage === stage);
                    return (
                        <section key={stage} aria-labelledby={`sign-${stage}`}>
                            <h3 id={`sign-${stage}`} className="text-xs font-semibold text-slate-900">{STAGE_LABEL[stage]}</h3>
                            {stage === "ISSUE" && issueOffered > 1 && <p className="mt-0.5 text-xs text-slate-600">You can sign one of these boxes; each is a different person on the paper card.</p>}
                            <table role="table" data-mobile="cards" className="mt-1 w-full text-sm md:table-fixed">
                                <colgroup>
                                    <col className="md:w-28" />
                                    <col />
                                    <col className="md:w-24" />
                                    <col className="md:w-24" />
                                </colgroup>
                                {/* The columns are named once, over the first stage; the later tables keep their headers for a screen reader. */}
                                <thead role="rowgroup" className={n === 0 ? undefined : "sr-only"}>
                                    <tr role="row" className="text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                                        <th role="columnheader" scope="col" className="pb-1 pr-3 font-semibold">Role</th>
                                        <th role="columnheader" scope="col" className="pb-1 pr-3 font-semibold">Name</th>
                                        <th role="columnheader" scope="col" className="pb-1 pr-3 font-semibold">Pay No.</th>
                                        <th role="columnheader" scope="col" className="pb-1 text-right font-semibold">Time</th>
                                    </tr>
                                </thead>
                                <tbody role="rowgroup">
                                    {signed.map((s) => (
                                        <tr role="row" key={s.id} className="border-t border-slate-100 align-baseline">
                                            <td role="cell" className="py-1.5 pr-3 text-slate-500 max-md:text-[11px] max-md:font-semibold max-md:uppercase max-md:tracking-[0.05em]">{ROLE_LABEL[s.role]}</td>
                                            <td role="cell" data-mobile="primary" className="py-1.5 pr-3 font-medium text-slate-900">
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
                                            <td role="cell" data-label="Pay No." className="py-1.5 pr-3 tabular-nums text-slate-600">{s.payNumber ?? "—"}</td>
                                            <td role="cell" data-label="Signed" className="py-1.5 tabular-nums text-xs text-slate-500 md:text-right">{when(s.at)}</td>
                                        </tr>
                                    ))}
                                    {waiting.map((w) => (
                                        <tr role="row" key={`${w.stage}-${w.role}`} className="border-t border-slate-100 align-middle">
                                            <td role="cell" className="py-1.5 pr-3 text-slate-500 max-md:text-[11px] max-md:font-semibold max-md:uppercase max-md:tracking-[0.05em]">{ROLE_LABEL[w.role]}</td>
                                            <td role="cell" colSpan={3} className="py-1.5">
                                                {!mine(w.stage, w.role) ? (
                                                    <span className="text-slate-500">Waiting</span>
                                                ) : w.role === "INSPECTOR" && route.check && (route.check.required || route.check.inspection) ? (
                                                    <CheckBox tenant={tenant} documentId={documentId} check={route.check} />
                                                ) : (
                                                    <SignBox tenant={tenant} documentId={documentId} box={w} me={route.me} driver={w.stage === "COLLECTION" ? route.driver : null} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>
                    );
                })}
            </div>
        </Panel>
    );
}

/**
 * The check bay's signature when its check is an inspection: start it, work
 * through it on the inspection screen, then sign here with what it found. A
 * quality check with a red item is failed and sent back to the workshop in
 * one press; the inspection decides, not a radio button.
 */
function CheckBox({ tenant, documentId, check }: { tenant: string; documentId: string; check: NonNullable<RouteView["check"]> }) {
    const what = check.purpose === "ASSESSMENT" ? "assessment" : "quality check";
    const [startState, start, starting] = useActionState(startCheckAction.bind(null, tenant, documentId), {} as MoveState);
    const [state, action, signing] = useRouteMove(signJobAction.bind(null, tenant, documentId));
    const i = check.inspection;
    const failed = check.purpose === "QUALITY_CHECK" && !!i && i.red > 0;
    return (
        <div className="flex flex-wrap items-center gap-2">
            {!i ? (
                <form action={start} className="flex flex-wrap items-center gap-2">
                    <Button type="submit" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={starting}>{starting ? "Starting…" : `Start the ${what}`}</Button>
                    <Outcome state={startState} />
                </form>
            ) : i.left > 0 ? (
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <Link href={`/${tenant}/dashboard/inspections/${i.id}`} className="font-medium text-teal-700 hover:underline">Continue the {what}</Link>
                    <span className="tabular-nums text-xs text-slate-500">{i.left} of {i.total} items not checked yet</span>
                </p>
            ) : (
                <form action={action} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="stage" value={check.purpose} />
                    <input type="hidden" name="role" value="INSPECTOR" />
                    {failed && <input type="hidden" name="returnToWork" value="1" />}
                    <p className="w-full text-sm text-slate-700">
                        {check.purpose === "QUALITY_CHECK" ? (
                            failed ? <><span className="font-semibold text-red-700">Failed:</span> {i.failed.join(", ")}</> : "Every item passed."
                        ) : i.red + i.amber > 0 ? (
                            `${i.red + i.amber} ${i.red + i.amber === 1 ? "finding goes" : "findings go"} onto the job card as its work.`
                        ) : (
                            "Nothing found."
                        )}{" "}
                        <Link href={`/${tenant}/dashboard/inspections/${i.id}`} className="text-teal-700 hover:underline">Open {i.number ?? `the ${what}`}</Link>
                    </p>
                    <input name="comment" placeholder="Note (optional)" aria-label={`Note on the ${what}`} maxLength={200} className={`${field} w-64 min-w-0`} />
                    <Button type="submit" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={signing}>
                        {signing ? "Signing…" : failed ? `Fail it and send it back to ${check.returnTo?.name ?? "the workshop"}` : check.purpose === "QUALITY_CHECK" ? "Pass it" : "Sign the assessment"}
                    </Button>
                    <Outcome state={state} />
                </form>
            )}
        </div>
    );
}

function SignBox({ tenant, documentId, box, me, driver }: { tenant: string; documentId: string; box: RouteView["waiting"][number]; me: RouteView["me"]; driver: RouteView["driver"] }) {
    const [state, action, signing] = useRouteMove(signJobAction.bind(null, tenant, documentId));
    const label = box.role === "DRIVER" ? "Record the driver's signature" : `Sign as ${ROLE_LABEL[box.role].toLowerCase()}`;
    return (
        <form action={action} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="stage" value={box.stage} />
            <input type="hidden" name="role" value={box.role} />
            {box.role === "DRIVER" && (
                <>
                    <input name="driverName" required defaultValue={driver?.name ?? ""} placeholder="Driver's name" aria-label="Driver's name" className={`${field} w-48 min-w-0 ${touch}`} />
                    <input name="driverPayNumber" defaultValue={driver?.payNumber ?? ""} placeholder="Pay No." aria-label="Driver's pay number" className={`${field} w-28 tabular-nums ${touch}`} />
                </>
            )}
            {box.stage === "QUALITY_CHECK" && (
                <fieldset className="flex items-center gap-3 text-sm text-slate-700">
                    <legend className="sr-only">Outcome</legend>
                    <label className={`inline-flex items-center gap-1.5 ${touch}`}><input type="radio" name="decision" value="PASSED" required className="accent-teal-700 pointer-coarse:size-5" />Passed</label>
                    <label className={`inline-flex items-center gap-1.5 ${touch}`}><input type="radio" name="decision" value="FAILED" className="accent-teal-700 pointer-coarse:size-5" />Failed</label>
                </fieldset>
            )}
            {(box.stage === "ASSESSMENT" || box.stage === "QUALITY_CHECK") && (
                <input name="comment" placeholder={box.stage === "ASSESSMENT" ? "What it needs" : "What failed, if it did"} aria-label={box.stage === "ASSESSMENT" ? "Assessment findings" : "Quality check findings"} maxLength={300} className={`${field} w-64 min-w-0 ${touch}`} />
            )}
            <Button type="submit" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={signing}>{signing ? "Signing…" : label}</Button>
            {/* Whose signature this records, so nobody signs for the wrong box by mistake. */}
            {box.role !== "DRIVER" && <span className="text-xs text-slate-600">{me.name}{me.payNumber ? ` · ${me.payNumber}` : ""}</span>}
            <Outcome state={state} />
        </form>
    );
}
