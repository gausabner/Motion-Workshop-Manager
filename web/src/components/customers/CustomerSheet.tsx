"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Mail, MessageCircle, Phone, X } from "lucide-react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import { money } from "@/lib/format";
import { whatsappLink } from "@/lib/format";

const WIDE = "(min-width: 640px)";
const watchWidth = (change: () => void) => {
    const query = window.matchMedia(WIDE);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
};

/**
 * A customer, over the list rather than instead of it.
 *
 * Deliberately a summary and not the whole screen. The question being answered
 * when somebody taps a name in a list is almost always "who is this and what do
 * they owe" — asked at a counter, with a phone in one hand. Everything else is
 * one tap further on, where the full page still lives.
 *
 * A sheet on a phone and a panel on a wider screen, because the gesture is
 * different: a thumb comes from the bottom, a mouse does not.
 */
export function CustomerSheet({
    tenant,
    customer,
    account,
    currency,
}: {
    tenant: string;
    customer: {
        id: string;
        firstName: string;
        lastName: string;
        mobile: string | null;
        phone: string | null;
        email: string | null;
        vehicles: { id: string; plate: string; make: string | null; model: string | null }[];
    };
    account: { balance: number | string } | null;
    currency: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(true);
    const wide = useSyncExternalStore(watchWidth, () => window.matchMedia(WIDE).matches, () => false);

    const base = `/${tenant}/dashboard`;
    const wa = whatsappLink(customer.mobile);
    const owing = account ? Number(account.balance) : null;
    const contact = "inline-flex h-11 items-center gap-2 rounded-sm border border-[var(--motion-field-edge)] bg-white px-3 text-sm font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-50";

    // Closing goes back, once the sheet has slid away: the list underneath was
    // never left, so back is where the person already was.
    return (
        <Drawer open={open} onOpenChange={setOpen} onOpenChangeComplete={(isOpen) => { if (!isOpen) router.back(); }} side={wide ? "right" : "bottom"}>
            <DrawerBackdrop className="fixed inset-0 bg-slate-900/40" />
            <DrawerContent className="flex max-h-[85dvh] w-full flex-col border-t border-slate-200 bg-white shadow-[0_25px_50px_-12px_rgb(15_23_42/0.10)] data-[side=right]:h-dvh data-[side=right]:max-h-none data-[side=right]:w-[420px] data-[side=right]:border-l data-[side=right]:border-t-0">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                        <DrawerTitle className="truncate text-lg font-bold text-slate-900">
                            {customer.firstName} {customer.lastName}
                        </DrawerTitle>
                        {owing !== null && (
                            <DrawerDescription className={`text-sm tabular-nums ${owing > 0 ? "text-amber-700" : "text-slate-600"}`}>
                                {owing > 0 ? `${money(owing, currency)} owing` : "Nothing owing"}
                            </DrawerDescription>
                        )}
                    </div>
                    <DrawerClose aria-label="Close" className="relative hit-area -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900">
                        <X className="h-5 w-5" aria-hidden="true" />
                    </DrawerClose>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    {/* Reaching them is the commonest reason for opening this. */}
                    <div className="flex flex-wrap gap-2">
                        {customer.mobile && (
                            <a href={`tel:${customer.mobile}`} className={contact}>
                                <Phone className="h-4 w-4" aria-hidden="true" />Call
                            </a>
                        )}
                        {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className={contact}>
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp<span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        )}
                        {customer.email && (
                            <a href={`mailto:${customer.email}`} className={contact}>
                                <Mail className="h-4 w-4" aria-hidden="true" />Email
                            </a>
                        )}
                    </div>

                    {(customer.mobile || customer.phone) && (
                        <dl className="mt-4 space-y-1 text-sm">
                            {customer.mobile && (
                                <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">Mobile</dt><dd className="tabular-nums text-slate-800">{customer.mobile}</dd></div>
                            )}
                            {customer.phone && (
                                <div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">Phone</dt><dd className="tabular-nums text-slate-800">{customer.phone}</dd></div>
                            )}
                        </dl>
                    )}

                    <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {customer.vehicles.length === 1 ? "Vehicle" : "Vehicles"}
                    </h3>
                    {customer.vehicles.length === 0 ? (
                        <p className="mt-1 text-sm text-slate-500">No vehicles on this customer yet.</p>
                    ) : (
                        <ul className="mt-1 space-y-1">
                            {customer.vehicles.map((v) => (
                                <li key={v.id}>
                                    <Link href={`${base}/vehicles/${v.id}`} className="flex items-center gap-2 rounded-sm px-1 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                        <Car className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                        <span className="rounded-sm bg-yellow-100 px-1.5 text-xs font-bold text-yellow-900">{v.plate}</span>
                                        <span className="truncate text-slate-600">{[v.make, v.model].filter(Boolean).join(" ")}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
                    <Link
                        href={`${base}/customers/${customer.id}`}
                        className="flex h-11 w-full items-center justify-center rounded-sm bg-teal-700 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800"
                    >
                        Open the full customer
                    </Link>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
