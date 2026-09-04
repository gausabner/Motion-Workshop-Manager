import * as React from "react"
import { cn } from "@/lib/utils"

export interface PillToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    labelOn?: string
    labelOff?: string
    disabled?: boolean
    className?: string
}

export function PillToggle({
    checked,
    onChange,
    labelOn = "YES",
    labelOff = "NO",
    disabled = false,
    className,
}: PillToggleProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-16 shrink-0 cursor-pointer items-center justify-between rounded-full border border-slate-300 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                checked ? "bg-teal-600 border-teal-600" : "bg-white",
                className
            )}
        >
            <span className="sr-only">Toggle switch</span>

            {/* Label ON (Left side, showing when checked) */}
            <span
                className={cn(
                    "absolute left-2 text-[9px] font-bold transition-opacity duration-200",
                    checked ? "opacity-100 text-white" : "opacity-0"
                )}
            >
                {labelOn}
            </span>

            {/* Label OFF (Right side, showing when unchecked) */}
            <span
                className={cn(
                    "absolute right-2 text-[9px] font-bold text-slate-400 transition-opacity duration-200",
                    !checked ? "opacity-100 text-teal-600" : "opacity-0"
                )}
            >
                {labelOff}
            </span>

            {/* The sliding circle */}
            <span
                className={cn(
                    "pointer-events-none absolute inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    checked ? "translate-x-[42px]" : "translate-x-[2px]",
                    !checked && "border border-slate-300 bg-slate-50"
                )}
            />
        </button>
    )
}
