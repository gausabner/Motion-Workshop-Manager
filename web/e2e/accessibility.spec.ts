import { test, expect, signIn } from "./workshop";
import { violations } from "./axe";

/**
 * WCAG 2.2 AA on the screens people spend their day on, checked by axe.
 *
 * The design audit of 20 October 2026 found about 160 lines of helper text at
 * 2.6:1 and pagination arrows a screen reader announced as bare "link". Both
 * were invisible from a desktop review and both are exactly what axe reads, so
 * this keeps them from creeping back one screen at a time.
 *
 * axe sees what is rendered, not what a person can do: it cannot judge whether
 * a label is clear, or whether the keyboard order makes sense. A pass here is
 * the floor, not the verdict.
 */

test.describe("accessibility", () => {
    // The rules are the same at every width; one engine keeps the suite quick.
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    for (const path of ["/", "/pricing", "/support", "/login", "/register", "/help"]) {
        test(`public: ${path}`, async ({ page }) => {
            await page.goto(path);
            expect(await violations(page)).toEqual([]);
        });
    }

    const screens = [
        "/dashboard",
        "/dashboard/customers",
        "/dashboard/vehicles",
        "/dashboard/jobs",
        "/dashboard/transactions",
        "/dashboard/payments",
        "/dashboard/schedule",
        "/dashboard/reports",
        "/dashboard/reports/receivables",
        "/dashboard/settings/company",
        "/dashboard/settings/users",
        "/dashboard/settings/billing",
        "/dashboard/settings/organisation",
        "/dashboard/settings/workshops",
        "/dashboard/settings/requisitions",
    ];

    test("signed-in screens", async ({ page, workshop }) => {
        await signIn(page, workshop);
        const report: Record<string, string[]> = {};
        for (const path of screens) {
            await page.goto(`/${workshop.slug}${path}`);
            const found = await violations(page);
            if (found.length) report[path] = found;
        }
        // Every screen is visited before failing, so one run lists them all.
        expect(report).toEqual({});
    });
});
