"use client";

import { Input } from "@/components/ui/input";

type Errors = Record<string, string[] | undefined>;

/**
 * A field inside an inline create panel. Deliberately has no `name`: the panel
 * sits inside the document form, and its inputs must not post with it. Enter
 * creates the record instead of submitting the document.
 */
export function QuickField({ label, value, onChange, onEnter, error, type = "text", autoFocus, inputClassName }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onEnter: () => void;
    error?: string;
    type?: string;
    autoFocus?: boolean;
    inputClassName?: string;
}) {
    return (
        <label className="block space-y-1">
            <span className="text-[11px] text-slate-600">{label}</span>
            <Input
                type={type}
                value={value}
                autoFocus={autoFocus}
                aria-invalid={!!error}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        onEnter();
                    }
                }}
                className={`h-8 bg-white text-sm ${inputClassName ?? ""}`}
            />
            {error && <span className="block text-xs text-red-600">{error}</span>}
        </label>
    );
}

export function firstError(errors: Errors, key: string): string | undefined {
    return errors[key]?.[0];
}
