import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { DiaryDay, DiaryMechanic } from "@/lib/diary/queries";
import type { DiarySettings } from "@/lib/diary/capacity";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/diary/actions", () => ({ bookSlotAction: vi.fn(async () => ({ ok: true })), moveBookingAction: vi.fn(async () => ({ ok: true })) }));

const { DayView } = await import("@/components/diary/DayView");

const settings: DiarySettings = { opensAt: 480, closesAt: 1020, slotMinutes: 30, workingDays: [1, 2, 3, 4, 5], fullAtPercent: 90, lanesPerPage: 6, defaultBookingMinutes: 60 };
const mechanics: DiaryMechanic[] = [
    { id: "m1", name: "Mike Hamutenya", initials: "MH" },
    { id: "m2", name: "Gaus Abner", initials: "GA" },
];
const load = { available: 540, booked: 60, percent: 11 };
const day: DiaryDay = {
    day: "2026-09-18",
    weekday: 5,
    open: true,
    load,
    lanes: [
        { mechanicId: "m1", working: { start: 480, end: 1020 }, off: [], load },
        { mechanicId: "m2", working: null, off: [], load: { available: 0, booked: 0, percent: 0 } },
    ],
    bookings: [
        { id: "b1", type: "JOB_CARD", number: null, jobNumber: "JC-1", jobStatus: "WAITING_FOR_PARTS", description: "Clutch", day: "2026-09-18", start: 480, minutes: 60, mechanicId: "m1", orphaned: false, customer: "Courtney Farrell", plate: "N 12345 W", vehicle: "Hilux" },
        { id: "b2", type: "JOB_CARD", number: null, jobNumber: "JC-2", jobStatus: "WORK_IN_PROGRESS", description: "Brakes", day: "2026-09-18", start: 510, minutes: 60, mechanicId: "m1", orphaned: false, customer: "Nicole Crous", plate: "N 31177 W", vehicle: "Polo" },
    ],
};

const view = () => render(<DayView tenant="t" day={day} mechanics={mechanics} settings={settings} nowMinute={null} canEdit />);

beforeEach(() => push.mockClear());

test("a booking is a button that says when, who, its status and a clash in words", () => {
    view();
    const first = screen.getByRole("button", { name: /^08:00.*Courtney Farrell/ });
    expect(first.textContent).toMatch(/Waiting for parts/);
    expect(first.textContent).toMatch(/until 09:00/);
    const second = screen.getByRole("button", { name: /^08:30.*Nicole Crous/ });
    expect(second.textContent).toMatch(/Work in progress.*clashes with another booking/);
});

test("Enter on a booking opens its job card", async () => {
    const user = userEvent.setup();
    view();
    screen.getByRole("button", { name: /^08:00.*Courtney Farrell/ }).focus();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledExactlyOnceWith("/t/dashboard/documents/b1");
});

test("a pointer that presses and lets go without moving opens the job once, not twice", async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("button", { name: /^08:00.*Courtney Farrell/ }));
    expect(push).toHaveBeenCalledExactlyOnceWith("/t/dashboard/documents/b1");
});

test("Book offers the lane's first free slot and moves focus to it; Escape takes the offer away", async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("button", { name: "Book with Mike Hamutenya" }));
    const offer = screen.getByRole("button", { name: "Book 09:30 with Mike" });
    expect(document.activeElement).toBe(offer);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: /^Book \d/ })).toBeNull();
});

test("Book on a mechanic who is off says so instead of offering a slot", async () => {
    const user = userEvent.setup();
    view();
    await user.click(screen.getByRole("button", { name: "Book with Gaus Abner" }));
    expect(screen.getByRole("status").textContent).toBe("Gaus Abner is not working on this day. Choose another mechanic or another day.");
    expect(screen.queryByRole("button", { name: /^Book \d/ })).toBeNull();
});

test("the resize grip is hidden from assistive technology: the job card's hours are the keyboard way", () => {
    view();
    const block = screen.getByRole("button", { name: /^08:00.*Courtney Farrell/ });
    const grip = block.querySelector(".cursor-ns-resize");
    expect(grip?.getAttribute("aria-hidden")).toBe("true");
});
