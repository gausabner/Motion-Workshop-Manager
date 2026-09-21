"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PickerHit } from "@/lib/search/types";

type Props<T extends PickerHit> = {
    label: string;
    /** Name of the hidden input carrying the chosen id, so the surrounding form still posts it. */
    name: string;
    value: T | null;
    onChange: (hit: T | null) => void;
    search: (query: string) => Promise<T[]>;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    /** When this changes the results are refetched — e.g. the chosen customer narrows the vehicles. */
    scopeKey?: string | null;
    /** Text for the create row, e.g. "New customer". Omit to hide inline create. */
    createLabel?: string;
    /** Inline create form. Call `done(hit)` to select what was created. */
    renderCreate?: (props: { query: string; done: (hit: T) => void; cancel: () => void }) => React.ReactNode;
    className?: string;
};

/**
 * Searchable combobox with inline create (R1c) — the benchmark's
 * "Select A Customer" panel, reduced to one field.
 *
 * Search is debounced and latest-request-wins, so fast typing never shows a
 * stale result. Keyboard: ↑ ↓ to move, Enter to choose (never submits the
 * surrounding form), Escape to close.
 */
export function EntityPicker<T extends PickerHit>({
    label, name, value, onChange, search, placeholder, disabled, error, scopeKey, createLabel, renderCreate, className,
}: Props<T>) {
    const id = useId();
    const listId = `${id}-list`;
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [hits, setHits] = useState<T[]>([]);
    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const requestRef = useRef(0);
    // Kept in a ref so a parent re-render handing us a new function does not refetch.
    const searchRef = useRef(search);
    useEffect(() => {
        searchRef.current = search;
    });

    const showCreate = !!createLabel && !!renderCreate;
    const total = hits.length + (showCreate ? 1 : 0);

    useEffect(() => {
        if (!open) return;
        const request = ++requestRef.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const result = await searchRef.current(query);
                if (request === requestRef.current) {
                    setHits(result);
                    setActive(0);
                }
            } finally {
                if (request === requestRef.current) setLoading(false);
            }
        }, query ? 200 : 0);
        return () => clearTimeout(timer);
    }, [query, open, scopeKey]);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    function choose(hit: T) {
        onChange(hit);
        setQuery("");
        setOpen(false);
        setCreating(false);
    }

    function startCreate() {
        setOpen(false);
        setCreating(true);
    }

    function clear() {
        onChange(null);
        setQuery("");
        setOpen(true);
        inputRef.current?.focus();
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(total - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === "Enter") {
            // Enter must never submit the document form around us.
            e.preventDefault();
            if (!open) return;
            if (active < hits.length) choose(hits[active]);
            else if (showCreate) startCreate();
        } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
        }
    }

    return (
        <div ref={rootRef} className={cn("relative space-y-1", className)}>
            <Label htmlFor={id} className="text-xs text-slate-600">{label}</Label>
            <input type="hidden" name={name} value={value?.id ?? ""} />
            <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                    ref={inputRef}
                    id={id}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={open && total > 0 ? `${id}-opt-${active}` : undefined}
                    aria-invalid={!!error}
                    autoComplete="off"
                    value={open ? query : value?.label ?? ""}
                    placeholder={placeholder}
                    disabled={disabled}
                    onFocus={() => {
                        setQuery("");
                        setOpen(true);
                    }}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    className="flex h-8 w-full rounded-md border border-input bg-white pl-7 pr-7 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {loading ? (
                    <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" aria-label="Searching" />
                ) : value && !disabled ? (
                    <button type="button" onClick={clear} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500" aria-label={`Clear ${label.toLowerCase()}`}>
                        <X className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>
            {!open && value?.sublabel && <p className="truncate text-[11px] text-slate-400">{value.sublabel}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}

            {open && (
                <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                    {hits.map((hit, i) => (
                        <li
                            key={hit.id}
                            id={`${id}-opt-${i}`}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => choose(hit)}
                            className={cn("flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5", i === active && "bg-teal-50")}
                        >
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-800">{hit.label}</span>
                                {hit.sublabel && <span className="block truncate text-[11px] text-slate-500">{hit.sublabel}</span>}
                            </span>
                            {value?.id === hit.id && <Check className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />}
                        </li>
                    ))}
                    {!loading && hits.length === 0 && (
                        <li className="px-3 py-2 text-slate-500">{query ? <>Nothing matches “{query}”.</> : "No records yet."}</li>
                    )}
                    {showCreate && (
                        <li
                            id={`${id}-opt-${hits.length}`}
                            role="option"
                            aria-selected={active === hits.length}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActive(hits.length)}
                            onClick={startCreate}
                            className={cn("flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-teal-700", active === hits.length && "bg-teal-50")}
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            {createLabel}
                            {query ? ` “${query}”` : ""}
                        </li>
                    )}
                </ul>
            )}

            {creating && renderCreate && (
                <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3">
                    {renderCreate({ query, done: choose, cancel: () => setCreating(false) })}
                </div>
            )}
        </div>
    );
}
