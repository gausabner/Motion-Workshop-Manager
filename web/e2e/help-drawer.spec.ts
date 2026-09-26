import { test, expect, signIn } from "./workshop";

/**
 * Help beside the work.
 *
 * The drawer's whole claim is that it opens on the right page without anybody
 * choosing one, so that is what this checks: stand on the stocktake screen,
 * press Help, and the article about counting shelves should already be open.
 * A drawer that opens on a table of contents has not done the thing it exists
 * to do.
 */

test("help opens over the screen you are on, already on the right page", async ({ page, workshop }) => {
    await signIn(page, workshop);

    await page.goto(`/${workshop.slug}/dashboard/products/stock-take`);
    await page.getByRole("button", { name: "Help for this screen" }).click();

    const drawer = page.getByRole("dialog", { name: "Help" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Counting the shelves" })).toBeVisible();
    // The answer leads, before any of the detail.
    await expect(drawer.getByText("Draw up a sheet, count onto it")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
});

test("a different screen gets a different page", async ({ page, workshop }) => {
    await signIn(page, workshop);

    await page.goto(`/${workshop.slug}/dashboard/reports/audit`);
    await page.getByRole("button", { name: "Help for this screen" }).click();

    const drawer = page.getByRole("dialog", { name: "Help" });
    // Two topics claim this screen at the same depth. The overview leads,
    // because somebody pressing Help on the audit page most often wants to
    // know what the six reports are — and the gap report is offered beside it
    // rather than buried.
    await expect(drawer.getByRole("heading", { name: "The six an auditor asks for" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Number sequence and gaps" })).toBeVisible();
});

test("the manual works with no session at all", async ({ page }) => {
    // It is served before login on an installed site, so it must not need one.
    await page.goto("/help/void-or-delete");
    await expect(page.getByRole("heading", { name: "Voiding and deleting", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("the drawer keeps the keyboard inside it, and gives it back", async ({ page, workshop }) => {
    // A dialog that declares aria-modal and leaves focus behind the scrim has
    // told a screen reader the page is inert while the user is still standing
    // on it. This is that promise, checked.
    await signIn(page, workshop);
    await page.goto(`/${workshop.slug}/dashboard/products/stock-take`);

    const trigger = page.getByRole("button", { name: "Help for this screen" });
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Help" });
    await expect(drawer).toBeVisible();

    // Focus went into the panel — not onto the search field, which on a phone
    // would raise the keyboard over the article they pressed Help to read.
    await expect(drawer).toBeFocused();

    // The page behind stopped scrolling.
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    // Tabbing stays inside the panel.
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    await expect(drawer.locator(":focus")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    // And the button that opened it has focus back.
    await expect(trigger).toBeFocused();
});
