import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { FEATURES, type Feature } from "@/lib/plans/features";

let pathname = "/t/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const { SidebarNav } = await import("@/components/layout/SidebarNav");
const everything = Object.keys(FEATURES) as Feature[];

function current() {
    render(<SidebarNav base="/t" reports cost manages features={everything} />);
    return screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.textContent);
}

beforeEach(() => {
    pathname = "/t/dashboard";
});

test("Dashboard is current only on the dashboard itself", () => {
    expect(current()).toEqual(["Dashboard"]);
});

test("a job card or invoice marks the list it belongs to, not Dashboard", () => {
    pathname = "/t/dashboard/documents/abc";
    expect(current()).toEqual(["Transactions"]);
});

test("an inspection marks Job cards", () => {
    pathname = "/t/dashboard/inspections/xyz";
    expect(current()).toEqual(["Job cards"]);
});

test("the longest match wins: Team, not Settings", () => {
    pathname = "/t/dashboard/settings/users";
    expect(current()).toEqual(["Team"]);
});

test("the longest match wins for reports too: Debtors, not All reports", () => {
    pathname = "/t/dashboard/reports/receivables";
    expect(current()).toEqual(["Debtors"]);
});

test("a screen no item names marks nothing rather than the wrong thing", () => {
    pathname = "/t/dashboard/nowhere-in-the-list";
    expect(current()).toEqual([]);
});

test("the navigation is labelled and each group is named by its caption", () => {
    render(<SidebarNav base="/t" reports cost manages features={everything} />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    for (const name of ["Today", "Work", "Money", "Parts and purchasing", "Setup"]) expect(screen.getByRole("group", { name })).toBeTruthy();
});
