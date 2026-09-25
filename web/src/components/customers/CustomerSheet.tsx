"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Mail, MessageCircle, Phone, X } from "lucide-react";
import { money } from "@/lib/format";
import { whatsappLink } from "@/lib/format";

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

    // Back closes the sheet, because that is what the gesture means when
    // something is covering what you were looking at.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") router.back();
        };
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [router]);

    const base = `/${tenant}/dashboard`;
    const wa = whatsappLink(customer.mobile);
    const owing = account ? Number(account.balance) : null;

    return (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${customer.firstName} ${customer.lastName}`}>
            <button
                type="button"
                aria-label="Close"
                onClick={() => router.back()}
                className="absolute inset-0 h-full w-full bg-slate-900/40"
            />

            {/* Up from the bottom on a phone; in from the side where there is room. */}
            <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-none">
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-slate-800">
                            {customer.firstName} {customer.lastName}
                        </h2>
                        {owing !== null && (
                            <p className={`text-sm tabular-nums ${owing > 0 ? "text-amber-700" : "text-slate-500"}`}>
                                {owing > 0 ? `${money(owing, currency)} owing` : "Nothing owing"}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Close"
                        className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                    {/* Reaching them is the commonest reason for opening this. */}
                    <div className="flex flex-wrap gap-2">
                        {customer.mobile && (
                            <a href={`tel:${customer.mobile}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">
                                <Phone className="h-4 w-4" aria-hidden="true" />Call
                            </a>
                        )}
                        {wa && (
                            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-medium text-white">
                                <MessageCircle className="h-4 w-4" aria-hidden="true" />WhatsApp
                            </a>
                        )}
                        {customer.email && (
                            <a href={`mailto:${customer.email}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">
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
                                    <Link href={`${base}/vehicles/${v.id}`} className="flex items-center gap-2 rounded-lg px-1 py-2 text-sm text-slate-700">
                                        <Car className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                                        <span className="rounded bg-yellow-100 px-1.5 text-xs font-bold text-yellow-900">{v.plate}</span>
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
                        className="flex h-11 w-full items-center justify-center rounded-lg bg-teal-600 text-sm font-semibold text-white"
                    >
                        Open the full customer
                    </Link>
                </div>
            </div>
        </div>
    );
}
