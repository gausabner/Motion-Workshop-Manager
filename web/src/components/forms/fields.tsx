"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[] | undefined> | undefined;

export function Field({ label, name, errors, hint, className, children }: { label: string; name: string; errors?: Errors; hint?: string; className?: string; children: React.ReactNode }) {
    const err = errors?.[name]?.[0];
    return (
        <div className={cn("space-y-1", className)}>
            <Label htmlFor={name} className="text-xs text-slate-600">{label}</Label>
            {children}
            {err ? <p className="text-xs text-red-600">{err}</p> : hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
        </div>
    );
}

type TextFieldProps = { label: string; name: string; errors?: Errors; defaultValue?: string | number | null; type?: string; className?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "name" | "type" | "className">;

export function TextField({ label, name, errors, defaultValue, type = "text", className, hint, ...rest }: TextFieldProps) {
    // A field the caller drives with `value` must not also carry a defaultValue:
    // React takes both as a contradiction and stops managing the input.
    const controlled = "value" in rest;
    return (
        <Field label={label} name={name} errors={errors} className={className} hint={hint}>
            <Input
                id={name} name={name} type={type} className="h-8 text-sm" aria-invalid={!!errors?.[name]}
                {...(controlled ? {} : { defaultValue: defaultValue ?? "" })}
                {...rest}
            />
        </Field>
    );
}

type SelectFieldProps = {
    label: string; name: string; errors?: Errors; options: { value: string; label: string }[]; allowEmpty?: string; className?: string; disabled?: boolean;
} & ({ defaultValue?: string | null; value?: never; onChange?: never } | { value: string; onChange: (value: string) => void; defaultValue?: never });

export function SelectField({ label, name, errors, defaultValue, options, allowEmpty, className, disabled, value, onChange }: SelectFieldProps) {
    const controlled = value !== undefined;
    return (
        <Field label={label} name={name} errors={errors} className={className}>
            <select
                id={name}
                name={name}
                disabled={disabled}
                {...(controlled ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue: defaultValue ?? "" })}
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
            >
                {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </Field>
    );
}

export function CheckField({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
    return (
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-teal-600" />
            <span>{label}{hint && <span className="block text-[11px] text-slate-400">{hint}</span>}</span>
        </label>
    );
}

export function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
    return (
        <section className={cn("border border-slate-200 rounded-sm bg-white", className)}>
            <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">{children}</div>
        </section>
    );
}
