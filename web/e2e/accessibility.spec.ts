import { test, expect, signIn, inWorkshop } from "./workshop";
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
    // Desktop and a phone, both Chromium: the rules are the same, but the
    // layout is not. Tables become cards, the sidebar becomes a tab bar and a
    // drawer, and what a screen reader meets changes with them.
    test.beforeEach(({}, testInfo) => {
        test.skip(!["chromium", "phone"].includes(testInfo.project.name), "Chromium on desktop and phone only");
    });

    for (const path of ["/", "/pricing", "/support", "/login", "/register", "/help", "/help/the-diary"]) {
        test(`public: ${path}`, async ({ page }) => {
            await page.goto(path);
            expect(await violations(page)).toEqual([]);
        });
    }

    const screens = [
        "/dashboard",
        "/dashboard/customers",
        "/dashboard/customers/new",
        "/dashboard/vehicles",
        "/dashboard/vehicles/new",
        "/dashboard/jobs",
        "/dashboard/transactions",
        "/dashboard/payments",
        "/dashboard/schedule",
        "/dashboard/reports",
        "/dashboard/notifications",
        "/dashboard/reports/receivables",
        "/dashboard/settings/company",
        "/dashboard/settings/users",
        "/dashboard/settings/billing",
        "/dashboard/settings/organisation",
        "/dashboard/settings/workshops",
        "/dashboard/settings/requisitions",
        "/dashboard/settings/tax",
        "/dashboard/products",
        "/dashboard/purchasing",
        "/dashboard/messages",
        "/dashboard/requisitions",
    ];

    test("signed-in screens", async ({ page, workshop }) => {
        await signIn(page, workshop);
        // A record of each kind, so the detail screens are checked too: they are
        // where the headings and the titles went missing.
        const job = await inWorkshop(workshop, (tx) =>
            tx.document.create({
                data: { tenantId: workshop.tenantId, type: "JOB_CARD", jobNumber: "JC-AXE", jobStatus: "BOOKED_IN", customerId: workshop.customer.id, vehicleId: workshop.vehicle.id },
                select: { id: true },
            }),
        );
        const detail = [`/dashboard/customers/${workshop.customer.id}`, `/dashboard/vehicles/${workshop.vehicle.id}`, `/dashboard/documents/${job.id}`];
        const report: Record<string, string[]> = {};
        for (const path of [...screens, ...detail]) {
            await page.goto(`/${workshop.slug}${path}`);
            const found = await violations(page);
            if (found.length) report[path] = found;
        }
        // Every screen is visited before failing, so one run lists them all.
        expect(report).toEqual({});
    });
});
