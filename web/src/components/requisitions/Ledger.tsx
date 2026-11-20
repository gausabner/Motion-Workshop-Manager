"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Outcome, Panel, field } from "@/components/settings/council/shared";
import { decideRequisitionAction, finaliseRequisitionAction, issueRequisitionAction } from "@/lib/requisitions/actions";
import type { LedgerAction, LedgerRow } from "@/lib/requisitions/ledger";
import type { RequisitionAnswer, RequisitionView } from "@/lib/requisitions/view";

/**
 * The sign-off ledger: the paper form's bottom row, every box in the form's
 * order from the start. Signed boxes carry the name, pay number and time they
 * were signed with; the box due now carries the 1px teal marker, and the
 * person whose turn it is signs it in its own row. Nothing else on the page
 * asks for a signature.
 */

export type Person = { id: string; name: string; payNumber: string | null };
type Answer = (a: RequisitionAnswer) => void;

const touch = "pointer-coarse:min-h-11";
const label = "text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500";
/** Box · who · pay number · when, on a wide screen; stacked on a phone. */
const columns = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 sm:grid-cols-[10rem_minmax(0,1fr)_6.5rem_7.5rem] sm:items-baseline";

export function Ledger({ tenant, view, people, me, when, onAnswer }: { tenant: string; view: RequisitionView; people: Person[]; me: string; when: (iso: string) => string; onAnswer: Answer }) {
    const { groups, earlier } = view.ledger;
    return (
        <Panel wide level={2} title="Signatures and handovers" footer="Each box keeps the name and pay number as they stood when it was signed. One person signs one box.">
            <div aria-hidden className={`hidden border-b border-slate-200 px-4 py-1.5 sm:grid ${columns} ${label}`}>
                <span>Box</span>
                <span>Name</span>
                <span>Pay No.</span>
                <span className="text-right">When</span>
            </div>
            {groups.map((g) => (
                <section key={g.title} aria-labelledby={`ledger-${g.title}`} className="border-b border-slate-200 last:border-b-0">
                    <h3 id={`ledger-${g.title}`} className={`bg-slate-50 px-4 pb-1 pt-2 ${label}`}>{g.title}</h3>
                    <ol className="divide-y divide-slate-100">
                        {g.rows.map((r) => (
                            <Row key={r.key} row={r} when={when}>
                                {r.action && <RowAction action={r.action} tenant={tenant} view={view} people={people} me={me} onAnswer={onAnswer} />}
                            </Row>
                        ))}
                    </ol>
                </section>
            ))}
            {earlier.length > 0 && (
                <details className="group border-t border-slate-200">
                    <summary className={`cursor-pointer list-none px-4 py-2 text-sm font-medium text-teal-700 hover:underline ${touch}`}>
                        Earlier rounds <span className="tabular-nums text-slate-600">({earlier.length})</span>
                    </summary>
                    <ol className="divide-y divide-slate-100 border-t border-slate-100">
                        {earlier.map((r) => <Row key={r.key} row={r} when={when} />)}
                    </ol>
                </details>
            )}
        </Panel>
    );
}

function Row({ row, when, children }: { row: LedgerRow; when: (iso: string) => string; children?: ReactNode }) {
    const signed = row.status === "signed";
    const due = row.status === "due";
    return (
        <li className="relative px-4 py-2.5 text-sm">
            {due && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-teal-700" />}
            <div className={columns}>
                <p className={`col-span-2 sm:col-span-1 ${due ? "font-medium text-slate-900" : "text-slate-600"} max-sm:text-[11px] max-sm:font-semibold max-sm:uppercase max-sm:tracking-[0.05em]`}>
                    {row.box}
                    {due && <span className="sr-only"> (its turn now)</span>}
                </p>
                <div className="min-w-0">
                    {signed ? (
                        <p className="font-medium text-slate-900">
                            {row.name}
                            {row.decision && <span className="font-normal text-slate-600"> · {row.decision}</span>}
                        </p>
                    ) : (
                        <p className={due ? "text-slate-900" : "text-slate-600"}>{row.waiting}</p>
                    )}
                    {row.items && <p className="text-xs text-slate-600">{row.items}</p>}
                    {row.comment && <p className="text-xs text-slate-700">“{row.comment}”</p>}
                </div>
                <p className="whitespace-nowrap text-right tabular-nums text-slate-600 sm:text-left">
                    {signed && <><span className="sr-only">Pay No. </span>{row.payNumber ?? "—"}</>}
                </p>
                <p className="col-span-2 tabular-nums text-xs text-slate-600 sm:col-span-1 sm:text-right sm:text-sm">
                    {row.at && <time dateTime={row.at}>{when(row.at)}</time>}
                </p>
            </div>
            {children && <div className="mt-3">{children}</div>}
        </li>
    );
}

function RowAction({ action, tenant, view, people, me, onAnswer }: { action: LedgerAction; tenant: string; view: RequisitionView; people: Person[]; me: string; onAnswer: Answer }) {
    if (action.kind === "decide") return <Decide tenant={tenant} view={view} onAnswer={onAnswer} />;
    if (action.kind === "issue") return <Issue tenant={tenant} view={view} people={people} me={me} onAnswer={onAnswer} />;
    const box = view.can.finalise.find((f) => f.step === action.step);
    return box ? <Finalise tenant={tenant} view={view} step={box.step} label={box.label} onAnswer={onAnswer} /> : null;
}

// ───────────────────────── approving ─────────────────────────

function Decide({ tenant, view, onAnswer }: { tenant: string; view: RequisitionView; onAnswer: Answer }) {
    const [state, action, pending] = useActionState(decideRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    const hint = useId();
    return (
        <form action={action} className="space-y-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                Your comment as {view.can.decide!.step.toLowerCase()}
                {/* Required to send it back or turn it down; Approve does not need one, so it skips the check. */}
                <input name="comment" required maxLength={300} aria-describedby={hint} className={`${field} w-full font-normal ${touch}`} />
                <span id={hint} className="font-normal text-slate-600">Needed to return it or reject it.</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" name="decision" value="APPROVED" formNoValidate size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>Approve</Button>
                <Button type="submit" name="decision" value="RETURNED" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={pending}>Return for changes</Button>
                <Button type="submit" name="decision" value="REJECTED" size="sm" variant="ghost" className={`h-9 text-slate-700 ${touch}`} disabled={pending}>Reject</Button>
                <Outcome state={state} />
            </div>
        </form>
    );
}

// ───────────────────────── issuing ─────────────────────────

/** Item names carry their own commas ("Gear oil 80W-90, 20 L"), so a list of them is joined with semicolons and "and". */
const list = (items: string[]) => (items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join("; ")} and ${items[items.length - 1]}`);

const num = (s: string) => {
    const t = s.trim().replace(",", ".");
    return t === "" ? 0 : Number(t);
};

/**
 * Stores hands parts over. The quantities start at what is still needed and
 * on the shelf; the receiver starts as the person who asked. Nothing leaves
 * the shelf until stores has read back, in a sentence, what goes to whom.
 */
function Issue({ tenant, view, people, me, onAnswer }: { tenant: string; view: RequisitionView; people: Person[]; me: string; onAnswer: Answer }) {
    const [state, action, pending] = useActionState(issueRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    const open = view.lines.filter((l) => l.stocked && l.outstanding > 0);
    const team = people.filter((p) => p.id !== me);
    const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(open.map((l) => [l.id, String(l.issueDefault)])));
    const [receiver, setReceiver] = useState(() => ({ other: false, id: team.some((p) => p.id === view.requesterId) ? view.requesterId : "", name: "", payNumber: "" }));
    const [problem, setProblem] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const nameField = useRef<HTMLInputElement>(null);
    const confirmButton = useRef<HTMLButtonElement>(null);
    const otherId = useId();

    const handing = open.map((l) => ({ line: l, quantity: num(qty[l.id] ?? "0") })).filter((h) => h.quantity !== 0);
    const chosen = team.find((p) => p.id === receiver.id);
    const who = receiver.other ? { name: receiver.name.trim(), payNumber: receiver.payNumber.trim() } : chosen ? { name: chosen.name, payNumber: chosen.payNumber ?? "" } : null;
    const charged = view.charge?.kind === "JOB" ? `It goes onto job ${view.charge.label} at cost` : view.charge ? `It is charged to vote ${view.charge.label}` : "It is charged as the requisition says";

    function review() {
        // The rules the server applies, read out here first so stores is not surprised by them after pressing.
        const bad = handing.find((h) => !Number.isFinite(h.quantity) || h.quantity < 0);
        const over = handing.find((h) => h.quantity > h.line.outstanding);
        const short = handing.find((h) => h.line.onHand !== null && h.quantity > h.line.onHand);
        const error = bad
            ? `Enter how many of “${bad.line.description}” as a number.`
            : !handing.length
              ? "Enter how many of at least one item are being handed over."
              : over
                ? `Only ${over.line.outstanding} of “${over.line.description}” ${over.line.outstanding === 1 ? "is" : "are"} still to be issued.`
                : short
                  ? `Only ${Math.max(0, short.line.onHand ?? 0)} of “${short.line.description}” ${short.line.onHand === 1 ? "is" : "are"} on the shelf. Issue what is there; the rest can follow.`
                  : !who || !who.name
                    ? "Name the person receiving the parts."
                    : receiver.other && !who.payNumber
                      ? "Enter the receiver's pay number. Somebody without a login is recorded by name and pay number."
                      : null;
        setProblem(error);
        if (!error) setConfirming(true);
    }
    useEffect(() => {
        if (confirming) confirmButton.current?.focus();
    }, [confirming]);

    if (confirming && who) {
        return (
            <form action={action} className="space-y-3 border border-slate-200 bg-white p-3">
                {handing.map((h) => <input key={h.line.id} type="hidden" name={`issue:${h.line.id}`} value={String(h.quantity)} />)}
                {receiver.other ? (
                    <>
                        <input type="hidden" name="receiverName" value={who.name} />
                        <input type="hidden" name="receiverPayNumber" value={who.payNumber} />
                    </>
                ) : (
                    <input type="hidden" name="receiverId" value={receiver.id} />
                )}
                <p className="text-sm text-slate-900">
                    Hand {list(handing.map((h) => `${h.quantity} × ${h.line.description}`))} to <span className="font-semibold">{who.name}</span>
                    {who.payNumber && <span className="whitespace-nowrap"> ({who.payNumber})</span>}.
                </p>
                <p className="text-xs text-slate-600">{charged}, and comes off the shelf now. You sign as stores; {who.name} signs as the one who received them.</p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button ref={confirmButton} type="submit" size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Issuing…" : "Confirm the issue"}</Button>
                    <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} disabled={pending} onClick={() => setConfirming(false)}>Change it</Button>
                    <Outcome state={state} />
                </div>
            </form>
        );
    }

    return (
        <div className="space-y-3">
            <table className="w-full text-sm">
                <thead>
                    <tr className={`text-left ${label}`}>
                        <th scope="col" className="pb-1 pr-3 font-semibold">Item</th>
                        <th scope="col" className="pb-1 pr-3 text-right font-semibold">On hand</th>
                        <th scope="col" className="pb-1 pr-3 text-right font-semibold">Still to issue</th>
                        <th scope="col" className="pb-1 text-right font-semibold">Issue now</th>
                    </tr>
                </thead>
                <tbody>
                    {open.map((l) => {
                        const short = l.onHand !== null && l.onHand < l.outstanding;
                        return (
                            <tr key={l.id} className="border-t border-slate-100 align-middle">
                                <td className="py-1.5 pr-3 text-slate-900">
                                    {l.itemCode && <span className="block tabular-nums text-xs text-slate-600">{l.itemCode}</span>}
                                    {l.description}
                                </td>
                                <td className={`py-1.5 pr-3 text-right tabular-nums ${short ? "font-semibold text-amber-700" : "text-slate-600"}`}>
                                    {l.onHand ?? "—"}
                                    {short && <span className="sr-only">, fewer than still to issue</span>}
                                </td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">{l.outstanding}</td>
                                <td className="py-1.5 text-right">
                                    <input
                                        value={qty[l.id] ?? ""}
                                        onChange={(e) => setQty((q) => ({ ...q, [l.id]: e.target.value }))}
                                        inputMode="decimal"
                                        aria-label={`Issue now: ${l.description}`}
                                        className={`${field} w-20 text-right tabular-nums ${touch}`}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                {receiver.other ? (
                    <div id={otherId} className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                            Receiver&rsquo;s name
                            <input ref={nameField} value={receiver.name} onChange={(e) => setReceiver((r) => ({ ...r, name: e.target.value }))} maxLength={80} className={`${field} w-56 max-w-full font-normal ${touch}`} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                            Pay No.
                            <input value={receiver.payNumber} onChange={(e) => setReceiver((r) => ({ ...r, payNumber: e.target.value }))} maxLength={30} className={`${field} w-28 font-normal tabular-nums ${touch}`} />
                        </label>
                    </div>
                ) : (
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                        Received by
                        <select value={receiver.id} onChange={(e) => setReceiver((r) => ({ ...r, id: e.target.value }))} className={`${field} w-64 max-w-full font-normal ${touch}`}>
                            <option value="" disabled>Choose who takes the parts</option>
                            {team.map((p) => <option key={p.id} value={p.id}>{p.name}{p.payNumber ? ` · ${p.payNumber}` : ""}</option>)}
                        </select>
                    </label>
                )}
                <button
                    type="button"
                    aria-expanded={receiver.other}
                    aria-controls={receiver.other ? otherId : undefined}
                    onClick={() => {
                        setReceiver((r) => ({ ...r, other: !r.other }));
                        // Opening the name fields puts the cursor in the first of them.
                        if (!receiver.other) requestAnimationFrame(() => nameField.current?.focus());
                    }}
                    className={`text-sm font-medium text-teal-700 hover:underline ${touch}`}
                >
                    {receiver.other ? "Choose from the team" : "Someone without a login"}
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} onClick={review}>Issue</Button>
                {problem && <p role="alert" className="text-xs text-red-700">{problem}</p>}
            </div>
        </div>
    );
}

// ───────────────────────── finalising ─────────────────────────

function Finalise({ tenant, view, step, label: box, onAnswer }: { tenant: string; view: RequisitionView; step: string; label: string; onAnswer: Answer }) {
    const [state, action, pending] = useActionState(finaliseRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <form action={action} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="step" value={step} />
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-700 sm:max-w-sm">
                Comment, if any
                <input name="comment" maxLength={300} className={`${field} w-full font-normal ${touch}`} />
            </label>
            <Button type="submit" size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Signing…" : `Sign as ${box.toLowerCase()}`}</Button>
            <Outcome state={state} />
        </form>
    );
}
