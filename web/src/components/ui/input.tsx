import * as React from "react";
import { Input as Base } from "@ui-sdk/react/input";

import { cn } from "@/lib/utils";

/** The field look every text control shares: square, a 3:1 edge, teal when focused, red-700 when refused. */
export const fieldClass =
    "w-full min-w-0 rounded-none border border-[var(--motion-field-edge)] bg-white text-base text-slate-900 transition-colors duration-150 outline-none placeholder:text-slate-500 focus:border-teal-700 aria-invalid:border-red-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-600 md:text-sm";

/**
 * A line of text, on ui-sdk's Input: inside a Field it takes its label, hint
 * and error from the field; outside one it is a plain input. Every native
 * input prop passes through, `onChange` included.
 */
function Input({ className, ...props }: React.ComponentProps<typeof Base>) {
    return <Base className={cn(fieldClass, "h-9 px-3 py-1 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium", className)} {...props} />;
}

export { Input };
