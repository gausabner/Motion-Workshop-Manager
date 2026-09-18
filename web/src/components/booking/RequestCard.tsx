"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, UserCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveBookingRequest, declineBookingRequest } from "@/lib/bookings/actions";
import { minuteLabel } from "@/lib/diary/time";
import { dayHeading } from "@/components/diary/shared";
import { SendDialog } from "@/components/messaging/SendDialog";
import type { QueueItem } from "@/lib/bookings/queries";

/**
 * One online request, with what approving it will actually do spelled out
 * first: whether this is a customer we know, whether their car is on file —
 * and on whose account — and whether anyone is free at that time.
 */
export function RequestCard({ tenant, item, mechanics }: { tenant: string; item: QueueItem; mechanics: { id: string; name: string }[] }) {
    const router = useRouter();
    const [mechanicId, setMechanicId] = useState(item.suggestedMechanicId ?? "");
    const [declining, setDeclining] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string>();
    const [done, setDone] = useState<{ documentId: string; note: string | null } | "declined" | null>(null);
    const [pending, start] = useTransition();
    const m = item.matches;

    function approve() {
        setError(undefined);
        start(async () => {
            const result = await approveBookingRequest(tenant, item.id, mechanicId || null);
            if (!result.ok) return setError(result.message);
            setDone({ documentId: result.documentId, note: result.note });
            router.refresh();
        });
    }

    function decline() {
        setError(undefined);
        start(async () => {
            const result = await declineBookingRequest(tenant, item.id, reason);
            if (!result.ok) return setError(result.message);
            setDone("declined");
            router.refresh();
        });
    }

    const wa = `https://wa.me/${item.mobile.replace(/\D/g, "")}`;

    return (
        <li className="rounded-sm border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-slate-800">{item.service} · {dayHeading(item.day)} at {minuteLabel(item.minute)}</p>
                    <p className="text-xs text-slate-500">about {item.minutes >= 60 ? `${item.minutes / 60}h` : `${item.minutes} min`} · requested {item.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Windhoek" })}</p>
                </div>
                <Link href={`/${tenant}/dashboard/schedule?view=day&date=${item.day}`} className="text-xs text-teal-700 hover:underline">See that day</Link>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                <div className="flex items-start gap-2">
                    {m.customer ? <UserCheck className="w-4 h-4 mt-0.5 text-teal-600" /> : <UserPlus className="w-4 h-4 mt-0.5 text-slate-400" />}
                    <div>
                        <p className="font-medium text-slate-700">{item.name} <a href={wa} target="_blank" rel="noopener noreferrer" className="font-normal text-teal-700 hover:underline">{item.mobile}</a></p>
                        <p className="text-xs text-slate-500">{m.customer ? <>Matches <strong>{m.customer.name}</strong> on file</> : "New customer — will be created"}{item.email ? ` · ${item.email}` : ""}</p>
                    </div>
                </div>
                <div className="text-xs text-slate-600">
                    <p className="text-sm font-medium text-slate-700">{item.plate ?? "No plate given"}{item.vehicle ? ` · ${item.vehicle}` : ""}</p>
                    {m.vehicle && m.decision === "attach" && <p className="text-teal-700">On file on this customer&rsquo;s account</p>}
                    {m.vehicle && m.decision === "adopt" && <p className="text-slate-500">On file with no owner — will be linked</p>}
                    {m.vehicle && m.decision === "conflict" && (
                        <p className="flex items-start gap-1 text-amber-800"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />On file for {m.vehicle.owner ?? "another customer"} — it will not be attached; check it on the booking</p>
                    )}
                    {!m.vehicle && item.plate && <p className="text-slate-500">Not on file — will be added</p>}
                </div>
            </div>
            {item.notes && <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">&ldquo;{item.notes}&rdquo;</p>}

            {done ? (
                done === "declined" ? (
                    <p className="text-sm text-slate-600">Declined. <a href={wa} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">Let {item.name.split(" ")[0]} know on WhatsApp</a>.</p>
                ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="flex items-center gap-1 text-teal-700"><Check className="w-4 h-4" />Booked.</span>
                        <Link href={`/${tenant}/dashboard/documents/${done.documentId}`} className="text-teal-700 hover:underline">Open the booking</Link>
                        <SendDialog tenant={tenant} target={{ kind: "DOCUMENT", id: done.documentId }} label="the booking confirmation" />
                        {done.note && <span className="w-full text-xs text-amber-800">{done.note}</span>}
                    </div>
                )
            ) : declining ? (
                <div className="flex flex-wrap items-center gap-2">
                    <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Why — you will tell the customer" className="h-8 flex-1 min-w-[200px] rounded-md border border-slate-300 px-2 text-sm" />
                    <Button type="button" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" disabled={pending} onClick={decline}>Decline</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <select value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} aria-label="Mechanic" className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                        <option value="">Unassigned</option>
                        {mechanics.map((mech) => <option key={mech.id} value={mech.id}>{mech.name}{mech.id === item.suggestedMechanicId ? " (free)" : ""}</option>)}
                    </select>
                    <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={pending} onClick={approve}><Check className="w-4 h-4 mr-1" />Approve</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-slate-500 hover:text-red-700" onClick={() => setDeclining(true)}><X className="w-4 h-4 mr-1" />Decline</Button>
                    {item.clashes && <span className="flex items-center gap-1 text-xs text-amber-800"><AlertTriangle className="w-3.5 h-3.5" />Nobody is free then — approving it will make a clash</span>}
                </div>
            )}
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </li>
    );
}
