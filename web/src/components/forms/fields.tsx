"use client";

import { useEffect, useId, useRef } from "react";
import { Check } from "lucide-react";
import { Checkbox, CheckboxIndicator } from "@ui-sdk/react/checkbox";
import { Field as Base, FieldControl, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input, fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Errors = Record<string, string[] | undefined> | undefined;

/**
 * When the server refuses a form, the first field it named takes focus, so a
 * keyboard or screen-reader user lands on the problem instead of hunting for
 * it. Each field checks whether it holds the form's first refusal.
 */
function useFocusWhenRefused(root: React.RefObject<HTMLDivElement | null>, err: string | undefined) {
    useEffect(() => {
        if (!err) return;
        const here = root.current;
        const first = (here?.closest("form") ?? document).querySelector<HTMLElement>('[aria-invalid="true"]');
        if (first && here?.contains(first)) first.focus();
    }, [root, err]);
}

/**
 * A labelled control with its hint and the server's error. The child must be
 * a ui-sdk control (`Input`, `Textarea`, `FieldControl`, `Checkbox`) so the
 * label, hint and error attach to it.
 */
export function Field({ label, name, errors, hint, className, children }: { label: string; name: string; errors?: Errors; hint?: string; className?: string; children: React.ReactNode }) {
    const err = errors?.[name]?.[0];
    const root = useRef<HTMLDivElement>(null);
    useFocusWhenRefused(root, err);
    return (
        <Base ref={root} invalid={err ? true : undefined} className={cn("space-y-1", className)}>
            <FieldLabel className="block text-xs text-slate-600">{label}</FieldLabel>
            {children}
            {hint && <FieldDescription className="text-[11px] leading-snug text-slate-500">{hint}</FieldDescription>}
            {err && <FieldError match className="text-xs text-red-700">{err}</FieldError>}
        </Base>
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
                id={name} name={name} type={type} className="h-8 px-2 text-sm"
                {...(controlled ? {} : { defaultValue: String(defaultValue ?? "") })}
                {...(rest as Omit<React.ComponentProps<typeof Input>, "defaultValue">)}
            />
        </Field>
    );
}

type SelectFieldProps = {
    label: string; name: string; errors?: Errors; options: { value: string; label: string }[]; allowEmpty?: string; className?: string; disabled?: boolean; hint?: string;
} & ({ defaultValue?: string | null; value?: never; onChange?: never } | { value: string; onChange: (value: string) => void; defaultValue?: never });

/** A native select: it opens the phone's own picker, which mechanics already know. */
export function SelectField({ label, name, errors, defaultValue, options, allowEmpty, className, disabled, value, onChange, hint }: SelectFieldProps) {
    const controlled = value !== undefined;
    return (
        <Field label={label} name={name} errors={errors} className={className} hint={hint}>
            <FieldControl
                render={<select />}
                id={name}
                name={name}
                disabled={disabled}
                {...(controlled ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) } : { defaultValue: defaultValue ?? "" })}
                className={cn(fieldClass, "h-8 px-2 text-sm")}
            >
                {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </FieldControl>
        </Field>
    );
}

export function CheckField({ label, name, defaultChecked, hint, onCheckedChange }: { label: string; name: string; defaultChecked?: boolean; hint?: string; onCheckedChange?: (checked: boolean) => void }) {
    return (
        <Base className="flex items-start gap-2 text-sm text-slate-700">
            <Checkbox
                name={name}
                defaultChecked={defaultChecked}
                onCheckedChange={onCheckedChange ? (checked) => onCheckedChange(checked === true) : undefined}
                className="relative hit-area mt-0.5 grid size-4 shrink-0 place-items-center border border-[var(--motion-field-edge)] bg-white text-white transition-colors duration-150 data-checked:border-teal-700 data-checked:bg-teal-700"
            >
                <CheckboxIndicator>
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                </CheckboxIndicator>
            </Checkbox>
            <span>
                <FieldLabel className="cursor-pointer">{label}</FieldLabel>
                {hint && <FieldDescription className="block text-[11px] text-slate-500">{hint}</FieldDescription>}
            </span>
        </Base>
    );
}

/**
 * A titled group of fields. A group named by its heading, so a screen reader
 * entering "Address 1" hears "Street address" first; the two addresses on a
 * customer use the same field names and only the group tells them apart.
 */
export function Section({ title, children, className, level = 2 }: { title: string; children: React.ReactNode; className?: string; level?: 2 | 3 }) {
    const Heading = level === 2 ? "h2" : "h3";
    const id = useId();
    return (
        <section role="group" aria-labelledby={id} className={cn("border border-slate-200 rounded-sm bg-white", className)}>
            <Heading id={id} className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</Heading>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">{children}</div>
        </section>
    );
}
