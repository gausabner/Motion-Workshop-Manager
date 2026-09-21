"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

/**
 * Moving between sites.
 *
 * Each site is a separate business, so this is not a filter — it is leaving one
 * set of books and opening another. The name of the one you are in stays on
 * screen at all times, because the expensive mistake here is invoicing the
 * right job to the wrong company.
 *
 * With only one site there is nothing to switch to, and the name simply sits
 * there as it always did.
 */
export function SiteSwitcher({ current, sites }: { current: string; sites: { slug: string; name: string }[] }) {
    const [open, setOpen] = useState(false);
    const here = sites.find((s) => s.slug === current);
    const name = here?.name ?? current;

    if (sites.length <= 1) {
        return (
            <div className="border-b px-4 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Workshop</p>
                <p className="truncate text-xs font-semibold text-slate-700" title={name}>{name}</p>
            </div>
        );
    }

    return (
        <div className="relative border-b px-2 py-2">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="menu"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-slate-100"
            >
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase tracking-wider text-slate-400">Workshop</span>
                    <span className="block truncate text-xs font-semibold text-slate-700" title={name}>{name}</span>
                </span>
                <ChevronsUpDown className="h-3 w-3 shrink-0 text-slate-400" />
            </button>

            {open && (
                <div role="menu" className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                    {sites.map((site) => (
                        <Link
                            key={site.slug}
                            href={`/${site.slug}/dashboard`}
                            role="menuitem"
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 ${site.slug === current ? "font-semibold text-slate-800" : "text-slate-600"}`}
                        >
                            {site.slug === current ? <Check className="h-3 w-3 shrink-0 text-teal-600" /> : <span className="w-3 shrink-0" />}
                            <span className="truncate" title={site.name}>{site.name}</span>
                        </Link>
                    ))}
                    <Link
                        href="/register"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                    >
                        <Plus className="h-3 w-3 shrink-0" />Add a workshop
                    </Link>
                </div>
            )}
        </div>
    );
}
