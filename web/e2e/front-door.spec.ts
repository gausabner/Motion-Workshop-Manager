import { test, expect } from "@playwright/test";

/**
 * The two front doors.
 *
 * The edition flag is read from the environment at request time, and this
 * suite runs against the cloud edition, so what it can prove here is that the
 * cloud door is right and that every page the shell links to actually exists.
 * A footer promising Terms and Privacy that 404 is the classic version of this
 * mistake, and it is invisible until somebody clicks.
 */

test("a signed-out visitor gets the front door, not a bare login form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("one document");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("the price is on the page, and it is the floor we set", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Pricing", level: 1 })).toBeVisible();
    // The entry tier is the number the whole pricing decision rests on.
    await expect(page.getByText("1,200").first()).toBeVisible();
    await expect(page.getByText("2,400").first()).toBeVisible();
    await expect(page.getByText("By quote").first()).toBeVisible();
});

test("every page the shell links to exists", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.locator("footer a, header a").evaluateAll((links) =>
        [...new Set(links.map((l) => (l as HTMLAnchorElement).getAttribute("href")))]
            .filter((h): h is string => !!h && h.startsWith("/")),
    );
    expect(hrefs.length).toBeGreaterThan(4);
    for (const href of hrefs) {
        const res = await page.request.get(href);
        expect(res.status(), `${href} should not be broken`).toBeLessThan(400);
    }
});

test("the legal drafts say they are drafts", async ({ page }) => {
    for (const path of ["/terms", "/privacy"]) {
        await page.goto(path);
        // Nothing here has been near a lawyer and the entity is not registered;
        // a page that read as settled would be the one dishonest thing on the site.
        await expect(page.getByText("This is a draft.")).toBeVisible();
    }
});

test("support names a real way to reach a person", async ({ page }) => {
    // CI sets the contact environment, as a deployment must. With none set the
    // page says so loudly rather than rendering an empty list — which is the
    // behaviour that makes a misconfigured deployment obvious instead of
    // quietly shipping a support page with nobody on it.
    await page.goto("/support");
    await expect(page.getByRole("heading", { name: "Support" })).toBeVisible();
    await expect(page.getByRole("link", { name: /@/ }).first()).toBeVisible();
    await expect(page.getByText("No support channels are configured")).toHaveCount(0);
});
