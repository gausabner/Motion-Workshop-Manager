import { act, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const sheet = {
    id: "d1", jobNumber: "JC-4181", description: "Replace front left wheel bearing", odometer: 148210, department: "Parks and Recreation",
    vehicle: { plate: "N 9921 W", make: "Toyota", model: "Hilux" },
    lines: [{ id: "l1", description: "Fit bearing kit, torque hub nut", quantity: 1.5, labour: true }],
    findings: [{ description: "Bearing play front left", comment: null, urgent: true }],
    parts: [{ id: "r1", number: "REQ-1008", state: "Issued", items: "1 × Bearing kit", waitingFor: null }],
    place: { name: "Light and medium vehicles", purpose: "WORK", arrived: true },
    note: { text: "Noise worst on left turns", from: "Selma Nghipondoka" },
    crew: [{ name: "Tobias Kandjii", lead: true, me: false }, { name: "Gaus Abner", lead: false, me: true }],
    time: { mine: 30, team: 72, estimate: 120 },
};
vi.mock("@/lib/time/floor-actions", () => ({ jobSheetAction: vi.fn(async () => sheet), scheduleAction: vi.fn(async () => ({ month: "2026-12", today: "2026-11-25", days: {} })) }));

const { Schedule } = await import("@/components/pwa/Schedule");
const { hoursLabel } = await import("@/lib/time/clock");

const month = {
    month: "2026-11",
    today: "2026-11-25",
    days: {
        "2026-11-25": [{ id: "d0", jobNumber: "JC-4184", title: "Shock absorber, rear", plate: "N 22015 W", minute: null, estimatedMinutes: null, status: "WAITING_FOR_PARTS" }],
        "2026-11-26": [{ id: "d1", jobNumber: "JC-4181", title: "Replace front left wheel bearing", plate: "N 9921 W", minute: 540, estimatedMinutes: 120, status: null }],
    },
};
const open = () => render(<Schedule tenant="t" initial={month} open onOpenChange={() => {}} startable={() => null} runningId={null} />);

test("the week is a stack of days, today open with its work", () => {
    open();
    const today = screen.getByRole("button", { name: /Wednesday.*25 November · Today.*1 job/i });
    expect(today.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /Thursday.*26 November.*1 job/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Shock absorber, rear")).toBeTruthy();
    expect(screen.getByText("Waiting for parts")).toBeTruthy();
});

test("the calendar marks the days with work, for screen readers too", () => {
    open();
    const grid = screen.getByRole("grid");
    expect(within(grid).getAllByText(", 1 job", { selector: "span" })).toHaveLength(2);
});

test("choosing another day opens it, and its job opens the job sheet on top", async () => {
    open();
    await act(async () => screen.getByRole("button", { name: /Thursday.*26 November/i }).click());
    expect(screen.getByRole("button", { name: /Thursday.*26 November/i }).getAttribute("aria-expanded")).toBe("true");
    await act(async () => screen.getByRole("button", { name: /09:00.*JC-4181/ }).click());
    const dialog = await screen.findByRole("dialog", { name: "Replace front left wheel bearing" });
    expect(within(dialog).getByText("Fit bearing kit, torque hub nut")).toBeTruthy();
    expect(within(dialog).getByText(/Noise worst on left turns/)).toBeTruthy();
    expect(within(dialog).getByText("Tobias Kandjii (lead) · You")).toBeTruthy();
    expect(within(dialog).getByRole("meter", { name: "Time on the job" }).getAttribute("aria-valuetext")).toBe(`${hoursLabel(72)} of ${hoursLabel(120)}`);
});
