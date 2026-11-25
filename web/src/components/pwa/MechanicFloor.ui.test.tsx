import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// jsdom puts a space between a button's words and its screen-reader detail ("Start : JC-4201"); browsers do not, so names match either.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/time/actions", () => ({ clockOnAction: vi.fn(async () => ({ ok: true })), clockOffAction: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/offline/actions", () => ({ syncClockQueue: vi.fn(async () => ({ problems: [] })) }));

const { MechanicFloor } = await import("@/components/pwa/MechanicFloor");
const { enqueue, newRef } = await import("@/lib/offline/client");

const bearing = {
    id: "d1", jobNumber: "JC-4201", description: "Replace front left wheel bearing", jobStatus: "WORK_IN_PROGRESS", time: null, estimatedMinutes: 120,
    customer: { firstName: "Parks and Recreation", lastName: "" },
    vehicle: { plate: "N 31877 W", make: "Toyota", model: "Hilux" },
    place: { name: "Light and medium vehicles", purpose: "WORK", arrived: true },
};
const service = { ...bearing, id: "d2", jobNumber: "JC-4203", description: null, vehicle: { plate: "N 22015 W", make: "Toyota", model: "Quantum" }, place: { name: "Tyre bay", purpose: "WORK", arrived: false } };
const floor = (running: { startedAt: string; job: typeof bearing } | null = null) =>
    render(<MechanicFloor tenant="t" name="Tobias" minutesToday={220} running={running} mine={[bearing, service]} others={[]} />);

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
    act(() => void enqueue({ kind: "on", ref: newRef(), at: "2026-11-25T09:42:00.000Z", documentId: "d2" }));
    floor();
    const held = screen.getByText(/^Not sent yet · started /);
    expect(held.closest("li")?.textContent).toContain("JC-4203");
});
