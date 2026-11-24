"use client";

import { useSyncExternalStore } from "react";

/**
 * Where a document's editing stands, shared by the parts of its page that are
 * separate components: the editor, the toolbar and the footer bar. Process,
 * Convert, Copy and Split act on the saved record, so they must know when what
 * is on screen is not what they would act on, and the footer's Save must know
 * when a save is on its way and what it said.
 */
export type Editing = { unsaved: boolean; saving: boolean; said: { ok: boolean; text: string } | null };

const IDLE: Editing = { unsaved: false, saving: false, said: null };
const docs = new Map<string, Editing>();
const listeners = new Set<() => void>();

function update(id: string, patch: Partial<Editing>): void {
    const was = docs.get(id) ?? IDLE;
    const next = { ...was, ...patch };
    if (next.unsaved === was.unsaved && next.saving === was.saving && next.said === was.said) return;
    docs.set(id, next);
    for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export function setUnsaved(id: string, unsaved: boolean): void {
    update(id, { unsaved });
}

export function setEditing(id: string, patch: Partial<Editing>): void {
    update(id, patch);
}

export function forget(id: string): void {
    if (docs.delete(id)) for (const listener of listeners) listener();
}

export function useEditing(id: string): Editing {
    return useSyncExternalStore(subscribe, () => docs.get(id) ?? IDLE, () => IDLE);
}

export function useUnsaved(id: string): boolean {
    return useEditing(id).unsaved;
}

/** The editor's form, which the footer bar's Save submits from outside it. */
export const editorFormId = (id: string) => `document-editor-${id}`;
