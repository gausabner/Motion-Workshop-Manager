import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settle } from "@ui-sdk/core/testing";
import { beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/documents/actions", () => ({ processDocument: vi.fn(async () => ({})) }));

const { ConfirmProvider } = await import("@/components/ui/confirm");
const { useLeaveGuard } = await import("@/components/documents/useLeaveGuard");
const { setUnsaved, useUnsaved } = await import("@/lib/documents/unsaved");
const { ProcessDialog } = await import("@/components/documents/ProcessDialog");

function Editor({ id }: { id: string }) {
    const unsaved = useUnsaved(id);
    useLeaveGuard(unsaved);
    return (
        <>
            <button type="button" onClick={() => setUnsaved(id, true)}>Type a line</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- stands in for next/link, which needs a mounted app router */}
            <a href="/t/dashboard/customers" onClick={(e) => { e.preventDefault(); push("/t/dashboard/customers"); }}>Customers</a>
        </>
    );
}

beforeEach(() => {
    push.mockClear();
    setUnsaved("d1", false);
});

test("with nothing unsaved, a link just goes", async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Editor id="d1" /></ConfirmProvider>);
    await user.click(screen.getByRole("link", { name: "Customers" }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/t/dashboard/customers");
    expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("with changes unsaved, a link asks first; staying keeps you, leaving goes", async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Editor id="d1" /></ConfirmProvider>);
    await user.click(screen.getByRole("button", { name: "Type a line" }));

    await user.click(screen.getByRole("link", { name: "Customers" }));
    await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(screen.getByRole("button", { name: "Stay on this document" }));
    await act(() => settle());
    expect(push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("link", { name: "Customers" }));
    await user.click(await screen.findByRole("button", { name: "Leave without saving" }));
    await act(() => settle());
    expect(push).toHaveBeenCalledExactlyOnceWith("/t/dashboard/customers");
});

test("Process waits while changes are unsaved: it stays in the tab order but does not open", async () => {
    const user = userEvent.setup();
    const doc = { id: "d1", type: "INVOICE", state: "DRAFT", total: 100, customer: null, vehicle: null, odometer: null, postDate: "2026-11-21", nextServiceKm: null, nextServiceDate: null } as unknown as Parameters<typeof ProcessDialog>[0]["doc"];
    const { rerender } = render(<ProcessDialog tenant="t" doc={doc} disabled />);
    const trigger = screen.getByRole("button", { name: "Process" });
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    await user.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<ProcessDialog tenant="t" doc={doc} />);
    await user.click(screen.getByRole("button", { name: "Process" }));
    expect(await screen.findByRole("dialog", { name: "Process this invoice" })).toBeTruthy();
});
