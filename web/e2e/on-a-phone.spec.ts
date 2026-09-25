import { test, expect, signIn, addCustomers } from "./workshop";

/**
 * The application on a 375px screen.
 *
 * Every mobile defect this project has had was found by someone opening it on
 * a real phone — a sidebar taking 48% of the display, a table 741px wide in a
 * 195px window, Save floating 67px above the tab bar, an inspection whose save
 * button was hidden behind the navigation. None of it was visible from a
 * desktop browser, and none of it would have been caught by the existing
 * suite.
 *
 * This is the cheapest guard against all of that coming back the next time
 * somebody builds a screen on a large monitor: not a check that the design is
 * good, but that the page fits, the navigation is reachable, and the tables
 * have stopped being tables.
 */

test.describe("on a phone", () => {
    // Desktop has its own coverage; running these there proves nothing.
    test.beforeEach(({}, testInfo) => {
        test.skip(!["phone", "iphone"].includes(testInfo.project.name), "phone projects only");
    });

    const screens = [
        ["the dashboard", "/dashboard"],
        ["customers", "/dashboard/customers"],
        ["vehicles", "/dashboard/vehicles"],
        ["the transaction centre", "/dashboard/transactions"],
        ["receipts", "/dashboard/payments"],
    ] as const;

    for (const [name, path] of screens) {
        test(`${name} fits the screen`, async ({ page, workshop }) => {
            await signIn(page, workshop);
            await page.goto(`/${workshop.slug}${path}`);
            await page.waitForLoadState("networkidle");

            // Sideways scrolling of the page itself is the symptom every one of
            // those defects produced. Individual tables and code blocks may
            // scroll inside their own container; the page may not.
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - window.innerWidth,
            );
            expect(overflow, `${name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);

            // The bottom bar is how anyone gets anywhere on a phone.
            await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

            // And the desktop sidebar must not be taking half the display.
            const sidebarWidth = await page.evaluate(() => {
                const el = document.querySelector("aside, .md\\:flex");
                if (!el) return 0;
                const r = el.getBoundingClientRect();
                return r.width > 0 && getComputedStyle(el).display !== "none" ? r.width : 0;
            });
            expect(sidebarWidth, "the desktop sidebar is still on screen").toBeLessThan(80);
        });
    }

    test("lists become cards rather than a table squeezed sideways", async ({ page, workshop }) => {
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers`);
        await page.waitForLoadState("networkidle");

        // The header row is what a card layout drops; if it is still laid out
        // as a row, the table never became a list.
        const headerVisible = await page.evaluate(() => {
            const head = document.querySelector('table[data-mobile="cards"] thead');
            return head ? getComputedStyle(head).display !== "none" : null;
        });
        expect(headerVisible, "no card-mode table found on the customer list").not.toBeNull();
        expect(headerVisible, "the table header is still showing, so it is still a table").toBe(false);
    });

    test("the primary action on a form clears the tab bar", async ({ page, workshop }) => {
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers/new`);
        await page.waitForLoadState("networkidle");

        const save = page.getByRole("button", { name: /^Save$/ });
        await expect(save.first()).toBeVisible();

        // It floated 67px above the bar once, showing a strip of the scrolling
        // page between the two. Flush or touching is right; a gap is not.
        const gap = await page.evaluate(() => {
            const nav = document.querySelector('nav[aria-label="Main"]');
            const bar = [...document.querySelectorAll("div")].find(
                (d) => getComputedStyle(d).position === "fixed" && /Save/.test(d.textContent ?? "") && d.className.includes("sm:hidden"),
            );
            if (!nav || !bar) return null;
            return Math.round(nav.getBoundingClientRect().top - bar.getBoundingClientRect().bottom);
        });
        expect(gap, "no sticky action bar found on the form").not.toBeNull();
        expect(Math.abs(gap ?? 999), `the action bar sits ${gap}px from the tab bar`).toBeLessThanOrEqual(2);
    });
    test("opening a customer keeps your place in the list", async ({ page, workshop }) => {
        await addCustomers(workshop.tenantId, 25);
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers`);
        await page.waitForLoadState("networkidle");

        // Clicking the last row rather than scrolling first and clicking the
        // first: Playwright scrolls an element into view before clicking it, so
        // pre-scrolling and then clicking a row at the top puts the list back
        // where it started and measures nothing.
        // The name in the card, which is the cell marked as the one that
        // identifies the record — not the desktop-only action icons, which are
        // present in the markup but hidden at this width.
        const rows = page.locator('td[data-mobile="primary"] a');
        await rows.last().click();
        await expect(page.getByRole("dialog")).toBeVisible();

        // The list scrolls inside <main>, not the window, which is why the
        // browser never restored this on a back navigation and why a full page
        // load put somebody back at the top of a long list.
        const opened = await page.evaluate(() => document.querySelector("main")!.scrollTop);
        expect(opened, "the list never scrolled, so keeping the place proves nothing").toBeGreaterThan(150);

        await page.goBack();
        await expect(page.getByRole("dialog")).toBeHidden();
        const closed = await page.evaluate(() => document.querySelector("main")!.scrollTop);
        expect(closed, "the place in the list was lost on the way back").toBe(opened);
    });
});
