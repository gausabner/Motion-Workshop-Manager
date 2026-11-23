import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Pager } from "@/components/ui/pager";

const href = (page: number) => `/list?page=${page}`;

test("on the first page there is no previous link to tab to, and the page says where you are", () => {
    render(<Pager page={1} pages={3} href={href} ends />);
    expect(screen.queryByRole("link", { name: "Previous page" })).toBeNull();
    expect(screen.queryByRole("link", { name: "First page" })).toBeNull();
    expect(screen.getByText("Previous page").closest("[aria-disabled]")?.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("/list?page=2");
    expect(screen.getByRole("link", { name: "Last page" }).getAttribute("href")).toBe("/list?page=3");
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe("Page 1 / 3");
});

test("on the last page there is no next link", () => {
    render(<Pager page={3} pages={3} href={href} />);
    expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe("/list?page=2");
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeTruthy();
});
