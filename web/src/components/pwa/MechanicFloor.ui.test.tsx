import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// jsdom puts a space between a button's words and its screen-reader detail ("Start : JC-4201"); browsers do not, so names match either.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/time/actions", () => ({ clockOnAction: vi.fn(async () => ({ ok: true })), clockOffAction: vi.fn(async () => ({ ok: true })), undoClockAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/notifications/actions", () => ({ floorNotificationsAction: vi.fn(async () => []), readNotificationAction: vi.fn(async () => {}), markAllReadAction: vi.fn(async () => {}) }));
vi.mock("@/lib/offline/actions", () => ({ syncClockQueue: vi.fn(async () => ({ problems: [] })) }));
vi.mock("@/lib/auth/actions", () => ({ logoutAction: vi.fn(async () => {}) }));
vi.mock("@/lib/time/floor-actions", () => ({ stopReasonAction: vi.fn(async () => ({ ok: true, message: "The job now shows Waiting for parts." })), jobSheetAction: vi.fn(async () => null), scheduleAction: vi.fn(async () => ({ month: "2026-12", today: "2026-11-25", days: {} })) }));

const { MechanicFloor } = await import("@/components/pwa/MechanicFloor");
const { enqueue, newRef, loadQueue, adoptUnownedQueue } = await import("@/lib/offline/client");
const { syncClockQueue } = await import("@/lib/offline/actions");
const { logoutAction } = await import("@/lib/auth/actions");

const bearing = {
    id: "d1", jobNumber: "JC-4201", description: "Replace front left wheel bearing", jobStatus: "WORK_IN_PROGRESS", time: null, estimatedMinutes: 120,
    customer: { firstName: "Parks and Recreation", lastName: "" },
    vehicle: { plate: "N 31877 W", make: "Toyota", model: "Hilux" },
    place: { name: "Light and medium vehicles", purpose: "WORK", arrived: true },
};
const service = { ...bearing, id: "d2", jobNumber: "JC-4203", description: null, vehicle: { plate: "N 22015 W", make: "Toyota", model: "Quantum" }, place: { name: "Tyre bay", purpose: "WORK", arrived: false } };
const day = { shiftMinutes: 480, jobsWorked: 2, waitingForParts: 1, weekMinutes: 1100, next: { jobNumber: "JC-4203", day: "2026-11-25", minute: 810 } };
const ui = (running: { startedAt: string; job: typeof bearing } | null = null) => (
    <MechanicFloor tenant="t" who="m1" name="Tobias" minutesToday={220} running={running} mine={[bearing, service]} others={[]} schedule={{ month: "2026-11", today: "2026-11-25", days: {} }} day={day} unread={0} />
);
const floor = (running: { startedAt: string; job: typeof bearing } | null = null) => render(ui(running));

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

test("each card says which job it is and where the vehicle is on its route", () => {
    floor();
    expect(screen.getByText("JC-4201")).toBeTruthy();
    expect(screen.getByText("At Light and medium vehicles, for work")).toBeTruthy();
    expect(screen.getByText("On its way to Tyre bay")).toBeTruthy();
    expect(screen.getByText("Toyota Hilux · Parks and Recreation · about 2h")).toBeTruthy();
    expect(screen.queryByText(/No customer/)).toBeNull();
    expect(screen.getByRole("button", { name: /^Start ?: JC-4201, N 31877 W, Replace front left wheel bearing$/ })).toBeTruthy();
});

test("the running job says so, and Stop names the job it stops", () => {
    floor({ startedAt: new Date().toISOString(), job: bearing });
    expect(screen.getByText("On the clock")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Stop ?: JC-4201$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Switch to this job ?: JC-4203/ })).toBeTruthy();
});

test("with nothing running there is no Stop to press", () => {
    floor();
    expect(screen.queryByRole("button", { name: /^Stop/ })).toBeNull();
});

test("a Start kept while there was no signal shows on its own card", () => {
    act(() => void enqueue("m1", { kind: "on", ref: newRef(), at: "2026-11-25T09:42:00.000Z", documentId: "d2" }));
    floor();
    const held = screen.getByText(/^Not sent yet · started /);
    expect(held.closest("li")?.textContent).toContain("JC-4203");
});

test("the Today strip gives the mechanic's own numbers", () => {
    floor();
    expect(screen.getByRole("meter", { name: "Today" }).getAttribute("aria-valuetext")).toBe("3h 40 of 8h");
    expect(screen.getByText("1 waiting for parts")).toBeTruthy();
    expect(screen.getByText("13:30")).toBeTruthy();
    expect(screen.getByText("18h 20")).toBeTruthy();
});

test("the clock bar measures the running job against its estimate", () => {
    floor({ startedAt: new Date(Date.now() - 12 * 60_000).toISOString(), job: bearing, priorMinutes: 60 } as never);
    const meter = screen.getByRole("meter", { name: "This job against its estimate" });
    expect(meter.getAttribute("aria-valuetext")).toBe("1h 12 of 2h");
});

test("Stop offers Undo and Why? in its toast; the reasons open only when asked, and the answer reaches the job", async () => {
    const { stopReasonAction } = await import("@/lib/time/floor-actions");
    const view = floor({ startedAt: new Date().toISOString(), job: bearing });
    await act(async () => screen.getByRole("button", { name: /^Stop ?: JC-4201$/ }).click());
    view.rerender(ui(null)); // the page the refresh brings back: nothing running
    expect(await screen.findByText("Clock stopped")).toBeTruthy();
    expect(screen.getByText("JC-4201", { selector: "[data-slot='toast-description']" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Why did you stop/ })).toBeNull();
    await act(async () => screen.getByRole("button", { name: "Say why you stopped" }).click());
    expect(screen.getByRole("region", { name: /Why did you stop JC-4201/ })).toBeTruthy();
    await act(async () => screen.getByRole("button", { name: /My part is done/ }).click());
    expect(stopReasonAction).toHaveBeenCalledWith("t", "d1", "DONE");
    expect(screen.queryByRole("region", { name: /Why did you stop/ })).toBeNull();
});

test("a second stop's Undo still reaches the server", async () => {
    const { undoClockAction } = await import("@/lib/time/actions");
    const view = floor({ startedAt: new Date().toISOString(), job: bearing });
    await act(async () => screen.getByRole("button", { name: /^Stop ?: JC-4201$/ }).click());
    view.rerender(ui(null));
    await act(async () => (await screen.findByRole("button", { name: "Undo" })).click());
    expect(undoClockAction).toHaveBeenCalledWith("t");
});

test("a job waiting for parts says so on its card, and sinks below the jobs that can be worked now", () => {
    render(
        <MechanicFloor tenant="t" who="m1" name="Tobias" minutesToday={0} running={null}
            mine={[{ ...bearing, jobStatus: "WAITING_FOR_PARTS" }, service]} others={[]}
            schedule={{ month: "2026-11", today: "2026-11-25", days: {} }} day={day} unread={0} />,
    );
    const cards = screen.getAllByRole("listitem");
    expect(cards[0].textContent).toContain("JC-4203");
    expect(cards[1].textContent).toContain("JC-4201");
    expect(cards[1].textContent).toContain("Waiting for parts");
});

test("the clock bar opens the running job's sheet, and the sheet offers Stop", async () => {
    floor({ startedAt: new Date().toISOString(), job: bearing });
    await act(async () => screen.getByRole("button", { name: "Open JC-4201" }).click());
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Stop" })).toBeTruthy();
});

test("a phone keeps each person's unsent taps apart, and sends only the signed-in person's", async () => {
    // Hilma's Start, made on this phone with no signal before she handed it over.
    enqueue("m2", { kind: "on", ref: "hilma-1", at: new Date().toISOString(), documentId: "d2" });
    vi.mocked(syncClockQueue).mockClear();
    await act(async () => void floor());
    expect(screen.queryByText(/Not sent yet/)).toBeNull();
    expect(vi.mocked(syncClockQueue)).not.toHaveBeenCalled();
    expect(loadQueue("m2")).toHaveLength(1);
});

test("taps kept before queues had owners go to the first person to open the floor", () => {
    window.localStorage.setItem("motion.clock.queue.v1", JSON.stringify([{ kind: "off", ref: "old-1", at: "2026-11-25T09:00:00.000Z" }]));
    adoptUnownedQueue("m1");
    expect(loadQueue("m1").map((e) => e.ref)).toEqual(["old-1"]);
    expect(window.localStorage.getItem("motion.clock.queue.v1")).toBeNull();
    adoptUnownedQueue("m2");
    expect(loadQueue("m2")).toEqual([]);
});

test("the floor can be handed over: signing out asks first, and says the clock keeps running", async () => {
    floor({ startedAt: new Date().toISOString(), job: bearing });
    await act(async () => screen.getByRole("button", { name: "Not Tobias? Sign out" }).click());
    const ask = screen.getByRole("region", { name: "Sign out of MOTION on this phone?" });
    expect(ask.textContent).toContain("Your clock on JC-4201 keeps running");
    await act(async () => within(ask).getByRole("button", { name: "Stay signed in" }).click());
    expect(screen.queryByRole("region", { name: "Sign out of MOTION on this phone?" })).toBeNull();
    await act(async () => screen.getByRole("button", { name: "Not Tobias? Sign out" }).click());
    await act(async () => screen.getByRole("button", { name: "Sign out" }).click());
    expect(vi.mocked(logoutAction)).toHaveBeenCalled();
});
