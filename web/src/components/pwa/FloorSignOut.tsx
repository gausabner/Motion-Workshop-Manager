"use client";

import { useState, useTransition } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { clearFloorPages } from "@/lib/offline/client";
import { waitingLabel } from "@/lib/offline/queue";

/**
 * Handing a shared phone to the next person.
 *
 * At the foot of the floor, out of the way of the work: a phone in a workshop
 * is often passed between mechanics, and the floor had no way out but the
 * office screens. Signing out here also removes the floor page the phone kept
 * for dead spots, so the next person cannot read this person's day offline.
 */
export function FloorSignOut({ name, running, waiting }: { name: string; running: string | null; waiting: number }) {
    const [asking, setAsking] = useState(false);
    const [problem, setProblem] = useState<string>();
    const [pending, start] = useTransition();

    function signOut() {
        setProblem(undefined);
        if (!navigator.onLine) {
            setProblem("There is no signal. Sign out when it returns.");
            return;
        }
        start(async () => {
            await clearFloorPages();
            try {
                await logoutAction();
            } catch (error) {
                // The redirect to the sign-in page arrives as a thrown navigation; anything else is a lost signal.
                if (error instanceof Error && /NEXT_REDIRECT/.test(error.message)) throw error;
                setProblem("That did not go through. Try again when the signal is steady.");
            }
        });
    }

    if (!asking) {
        return (
            <p className="pt-2 text-center">
                <button type="button" onClick={() => setAsking(true)} className="floor-press inline-flex min-h-11 items-center px-3 text-base text-slate-600 underline decoration-slate-300 underline-offset-4 active:text-slate-900">
                    Not {name}? Sign out
                </button>
            </p>
        );
    }

    return (
        <section aria-labelledby="floor-sign-out" className="rounded-sm border border-slate-300 bg-white p-4">
            <h2 id="floor-sign-out" className="text-base font-semibold text-slate-900">Sign out of MOTION on this phone?</h2>
            <ul className="mt-2 space-y-1 text-base text-slate-700">
                {running && <li>Your clock on {running} keeps running. Stop it first if you are leaving the job.</li>}
                {waiting > 0 && <li>{waitingLabel(waiting)}. They stay on this phone and are sent when you sign in here again.</li>}
                <li>The next person signs in with their own email and password.</li>
            </ul>
            {problem && <p role="alert" className="mt-3 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-base text-red-800">{problem}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setAsking(false)} className="floor-press h-12 rounded-sm border border-slate-300 bg-white text-base font-medium text-slate-900 active:bg-slate-100">
                    Stay signed in
                </button>
                <button type="button" onClick={signOut} disabled={pending} className="floor-press h-12 rounded-sm bg-teal-700 text-base font-semibold text-white active:bg-teal-800 disabled:opacity-60">
                    {pending ? "Signing out…" : "Sign out"}
                </button>
            </div>
        </section>
    );
}
