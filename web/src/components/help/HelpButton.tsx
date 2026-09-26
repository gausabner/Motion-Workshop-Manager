"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * The trigger, and only the trigger.
 *
 * The panel is imported dynamically because it pulls in the whole library —
 * seventeen articles of prose, the renderer and the search index. Bundling
 * that into every signed-in page would make a workshop wait for help it has
 * not asked for on the one screen where speed matters most, the counter.
 *
 * Nothing is fetched until somebody presses the button, and on an installed
 * site that first press pulls a chunk already sitting on their own server.
 */
const HelpDrawer = dynamic(() => import("@/components/help/HelpDrawer").then((m) => m.HelpDrawer));

export function HelpButton() {
    // `mounted` stays true once opened, so closing and reopening does not
    // re-request the chunk.
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);

    /**
     * Stable identity, because the drawer's focus trap keys its effect on
     * this and a fresh callback each render would tear the trap down and
     * re-run it, snatching focus mid-read.
     *
     * Returning focus happens here rather than inside the drawer because only
     * the opener knows what opened it. Safari does not focus a button when it
     * is clicked, so a panel reading document.activeElement on open finds
     * <body> on an iPhone and has nothing to give back.
     */
    const close = useCallback(() => {
        setOpen(false);
        trigger.current?.focus();
    }, []);

    return (
        <>
            <button
                ref={trigger}
                type="button"
                onClick={() => { setMounted(true); setOpen(true); }}
                aria-label="Help for this screen"
                title="Help for this screen"
                className="flex h-8 w-8 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
                <HelpCircle aria-hidden strokeWidth={1.75} className="h-[18px] w-[18px]" />
            </button>
            {mounted && <HelpDrawer open={open} onClose={close} />}
        </>
    );
}
