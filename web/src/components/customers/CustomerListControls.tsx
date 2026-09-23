"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function CustomerListControls({ q, archived }: { q: string; archived: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [value, setValue] = useState(q);
    const [, startTransition] = useTransition();

    function push(next: { q?: string; archived?: boolean }) {
        const params = new URLSearchParams();
        const nq = next.q ?? value;
        const na = next.archived ?? archived;
        if (nq) params.set("q", nq);
        if (na) params.set("archived", "1");
        startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`));
    }

    return (
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
            <label className="flex items-center bg-white rounded-full border border-slate-300 px-3 py-1 gap-2 shrink-0 shadow-sm cursor-pointer">
                <Switch checked={!archived} onCheckedChange={(on) => push({ archived: !on })} className="data-[state=checked]:bg-teal-500 scale-75 origin-left" />
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mr-1">{archived ? "Archived" : "Active"}</span>
            </label>
            <form
                className="relative w-full min-w-0 sm:w-64"
                onSubmit={(e) => { e.preventDefault(); push({ q: value }); }}
            >
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                    type="search"
                    placeholder="Name, mobile, email or plate…"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="pl-8 pr-8 py-1 h-8 rounded-sm bg-white border-slate-300 shadow-sm text-base sm:text-sm focus-visible:ring-1 focus-visible:ring-teal-500"
                />
                {value && (
                    <button type="button" onClick={() => { setValue(""); push({ q: "" }); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </form>
        </div>
    );
}
