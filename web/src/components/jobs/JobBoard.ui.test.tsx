import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const setJobStatus = vi.fn(async () => undefined);
vi.mock("@/lib/documents/actions", () => ({ setJobStatus: (...args: unknown[]) => setJobStatus(...(args as [])) }));

const { JobBoard } = await import("@/components/jobs/JobBoard");
type Jobs = Parameters<typeof JobBoard>[0]["jobs"];

const jobs = [
    {
        id: "j1", jobNumber: "JC-1001", jobStatus: "BOOKED_IN", total: 1820, statusComment: null, labourHours: 1.5, _count: { lines: 3 },
        customer: { firstName: "Courtney", lastName: "Farrell" }, vehicle: { make: "Toyota", model: "Hilux", plate: "N 12345 W" },
        mechanic: { user: { firstName: "Mike", lastName: "Hamutenya" } },
    },
] as unknown as Jobs;

beforeEach(() => setJobStatus.mockClear());

test("each column names its status in words, with its count", () => {
    render(<JobBoard tenant="t" jobs={jobs} showCost />);
    const booked = screen.getByRole("region", { name: /Booked in/ });
    expect(within(booked).getByRole("heading", { name: "Booked in" })).toBeTruthy();
    expect(booked.textContent).toMatch(/1 job/);
});

test("a card says what its figures are, not only in a tooltip", () => {
    render(<JobBoard tenant="t" jobs={jobs} showCost />);
    const card = screen.getByRole("link", { name: /Courtney Farrell/ });
    expect(card.textContent).toMatch(/1\.5 h labour/);
    expect(card.textContent).toMatch(/3 lines/);
    expect(card.textContent).toMatch(/Mike Hamutenya/);
});

test("choosing a status moves nothing; Move does, and says so", async () => {
    const user = userEvent.setup();
    render(<JobBoard tenant="t" jobs={jobs} showCost />);
    const status = screen.getByRole("combobox", { name: "Status for JC-1001" });
    const moveButton = screen.getByRole("button", { name: "Move JC-1001" });
    expect((moveButton as HTMLButtonElement).disabled).toBe(true);

    await user.selectOptions(status, "WAITING_FOR_PARTS");
    expect(setJobStatus).not.toHaveBeenCalled();

    await user.click(moveButton);
    await act(async () => {});
    expect(setJobStatus).toHaveBeenCalledExactlyOnceWith("t", "j1", "WAITING_FOR_PARTS");
    expect(screen.getByRole("status").textContent).toBe("Moved JC-1001 to Waiting for parts.");
});
