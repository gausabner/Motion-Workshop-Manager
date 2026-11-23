import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/documents/actions", () => ({ processDocument: vi.fn(async () => ({})), saveDocument: vi.fn(async () => ({ ok: true })) }));

const { DocumentFooterBar } = await import("@/components/documents/DocumentFooterBar");
const { editorFormId, forget, setEditing } = await import("@/lib/documents/unsaved");

const doc = { id: "d1", type: "INVOICE", state: "DRAFT", total: 100, customer: null, vehicle: null, odometer: null, postDate: "2026-11-23", nextServiceKm: null, nextServiceDate: null } as unknown as Parameters<typeof DocumentFooterBar>[0]["doc"];
const bar = () => render(<DocumentFooterBar tenant="t" doc={doc} canProcess showProcess />);

beforeEach(() => forget("d1"));

test("a saved draft says so, Save is plain and Process is the filled button", () => {
    bar();
    expect(screen.getByRole("status").textContent).toBe("Draft. Nothing is posted until you process it.");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save.getAttribute("form")).toBe(editorFormId("d1"));
    expect(save.getAttribute("data-variant")).toBe("outline");
    expect(screen.getByRole("button", { name: "Process" }).getAttribute("aria-disabled")).toBeNull();
});

test("with unsaved changes Save is the filled button and Process waits", () => {
    bar();
    act(() => setEditing("d1", { unsaved: true }));
    expect(screen.getByRole("status").textContent).toBe("Unsaved changes. Save before you process.");
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("data-variant")).toBe("default");
    expect(screen.getByRole("button", { name: "Process" }).getAttribute("aria-disabled")).toBe("true");
});

test("while a save is on its way it says so, and nothing can be pressed twice", () => {
    bar();
    act(() => setEditing("d1", { unsaved: true, saving: true }));
    expect(screen.getByRole("status").textContent).toBe("Saving…");
    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Process" }).getAttribute("aria-disabled")).toBe("true");
});

test("after a save that worked, it reports the answer and Process is ready", () => {
    bar();
    act(() => setEditing("d1", { unsaved: false, saving: false, said: { ok: true, text: "Saved" } }));
    expect(screen.getByRole("status").textContent).toBe("Saved");
    expect(screen.getByRole("button", { name: "Process" }).getAttribute("aria-disabled")).toBeNull();
});

test("on a council route Process stays under More, so the bar offers Save only", () => {
    render(<DocumentFooterBar tenant="t" doc={doc} canProcess showProcess={false} />);
    expect(screen.queryByRole("button", { name: "Process" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
});
