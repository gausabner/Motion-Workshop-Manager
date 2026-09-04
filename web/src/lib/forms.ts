import { z } from "zod";

/** Shape returned by every form server action used with `useActionState`. */
export type ActionState = {
    ok?: boolean;
    message?: string;
    errors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = {};

/** Trimmed string from FormData; empty → undefined. */
export function str(fd: FormData, name: string): string | undefined {
    const v = fd.get(name);
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t === "" ? undefined : t;
}

export function bool(fd: FormData, name: string): boolean {
    const v = fd.get(name);
    return v === "on" || v === "true" || v === "1";
}

export function fromZod(error: z.ZodError): ActionState {
    const flat = z.flattenError(error);
    return { ok: false, message: "Please fix the highlighted fields.", errors: flat.fieldErrors as ActionState["errors"] };
}

/** Optional numeric field: undefined stays undefined, "" → undefined, else coerced. */
export const optionalNumber = z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().finite().optional());
export const optionalInt = z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : Number(v)), z.number().int().optional());
/** Optional ISO date (yyyy-mm-dd) → Date at UTC midnight. */
export const optionalDate = z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd").transform((s) => new Date(`${s}T00:00:00Z`)).optional(),
);
