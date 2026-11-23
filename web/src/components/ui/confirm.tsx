"use client";

import * as React from "react";
import {
    AlertDialog,
    AlertDialogBackdrop,
    AlertDialogClose,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
    createConfirm,
} from "@ui-sdk/react/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

/**
 * A question that needs an answer before something happens: cancelling an
 * order, revoking a key, signing out. `confirm` is the verb on the agreeing
 * button, so it says what happens ("Cancel the order"), never "OK".
 * `agent` is what an assistant must ask the person before pressing it.
 */
export type Question = { title: string; description?: string; confirm: string; cancel?: string; agent?: string };

const Ask = React.createContext<((question: Question) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [confirm] = React.useState(() => createConfirm<Question>());
    return (
        <Ask.Provider value={confirm}>
            {children}
            <AlertDialog controller={confirm.controller}>
                <AlertDialogBackdrop className="fixed inset-0 bg-slate-900/20 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150" />
                <AlertDialogContent<Question> className="fixed inset-0 m-auto h-fit w-[min(28rem,calc(100vw-2rem))] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_25px_50px_-12px_rgb(15_23_42/0.10)] motion-safe:transition-[opacity,scale] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150 motion-safe:data-starting-style:scale-[0.97] motion-safe:data-ending-style:scale-[0.97]">
                    {(state) =>
                        state.payload && (
                            <>
                                <AlertDialogTitle className="text-base font-semibold leading-snug">{state.payload.title}</AlertDialogTitle>
                                {state.payload.description && (
                                    <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-slate-600">{state.payload.description}</AlertDialogDescription>
                                )}
                                <div className="mt-5 flex flex-wrap justify-end gap-2">
                                    <AlertDialogClose className={buttonVariants({ variant: "outline" })}>{state.payload.cancel ?? "Cancel"}</AlertDialogClose>
                                    <AlertDialogClose value="confirm" data-agent-confirm={state.payload.agent ?? state.payload.title} className={buttonVariants()}>
                                        {state.payload.confirm}
                                    </AlertDialogClose>
                                </div>
                            </>
                        )
                    }
                </AlertDialogContent>
            </AlertDialog>
        </Ask.Provider>
    );
}

/** Ask, and wait for the answer: `if (!(await confirm({ ... }))) return;`. */
export function useConfirm() {
    const confirm = React.useContext(Ask);
    if (!confirm) throw new Error("useConfirm needs a ConfirmProvider above it.");
    return confirm;
}
