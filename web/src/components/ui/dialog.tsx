"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import {
    Dialog as Root,
    DialogBackdrop,
    DialogClose as Close,
    DialogContent as Content,
    DialogDescription as Description,
    DialogTitle as Title,
    DialogTrigger as Trigger,
} from "@ui-sdk/react/dialog";

import { cn } from "@/lib/utils";

/**
 * A focused task over the page, on ui-sdk's Dialog: focus moves in, Tab stays
 * inside, Escape and the backdrop close it, and focus goes back to the
 * trigger. Open it from a `DialogTrigger` so there is a trigger to go back to.
 */
function Dialog(props: React.ComponentProps<typeof Root>) {
    return <Root {...props} />;
}

const DialogTrigger = Trigger;
const DialogClose = Close;

function DialogContent({
    className,
    children,
    showCloseButton = true,
    ...props
}: Omit<React.ComponentProps<typeof Content>, "children"> & { children?: React.ReactNode; showCloseButton?: boolean }) {
    return (
        <>
            <DialogBackdrop className="fixed inset-0 bg-slate-900/20 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150" />
            <Content
                className={cn(
                    "fixed inset-0 m-auto grid h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg gap-4 overflow-y-auto border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_25px_50px_-12px_rgb(15_23_42/0.10)] outline-none sm:p-6",
                    "motion-safe:transition-[opacity,scale] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150 motion-safe:data-starting-style:scale-[0.97] motion-safe:data-ending-style:scale-[0.97]",
                    className,
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <Close aria-label="Close" className="hit-area absolute right-3 top-3 grid size-8 place-items-center rounded-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900">
                        <XIcon className="size-4" aria-hidden="true" />
                    </Close>
                )}
            </Content>
        </>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8 text-left", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
    return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof Title>) {
    return <Title className={cn("text-base font-semibold leading-snug", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof Description>) {
    return <Description className={cn("text-sm leading-relaxed text-slate-600", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
