"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * When something actually broke.
 *
 * Two things matter here and neither is the apology. First, the work someone
 * was doing may still be recoverable — "Try again" re-renders the segment
 * rather than reloading the app, so a transient database hiccup costs nothing.
 * Second, the digest: React strips error messages in production, and this
 * short code is the only thing connecting what the person saw to what the
 * server logged. Without it a support call is two people guessing.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center sm:py-20">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-700">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">That did not work</h1>
            <p className="mt-2 text-sm text-slate-600">
                Something went wrong on our side, not yours. Nothing you had already saved is affected.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                <Button onClick={reset} className="h-11 bg-teal-600 px-5 hover:bg-teal-700">Try again</Button>
            </div>
            {error.digest && (
                <p className="mt-6 font-mono text-[11px] text-slate-400">
                    Reference {error.digest} — quote this if you report it
                </p>
            )}
        </div>
    );
}
