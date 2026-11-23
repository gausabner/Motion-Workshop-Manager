"use client";

import { useSyncExternalStore } from "react";

/**
 * Which documents have changes on screen that are not saved yet. The editor
 * and the toolbar are separate components on the page, and the toolbar's
 * Process, Convert, Copy and Split all act on the saved record: they must know
 * when what is on screen is not what they would act on.
 */
const unsaved = new Set<string>();
const listeners = new Set<() => void>();

export function setUnsaved(id: string, value: boolean): void {
    if (unsaved.has(id) === value) return;
    if (value) unsaved.add(id);
    else unsaved.delete(id);
    for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export function useUnsaved(id: string): boolean {
    return useSyncExternalStore(subscribe, () => unsaved.has(id), () => false);
}
