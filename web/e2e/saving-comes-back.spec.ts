import { test, expect, signIn, inWorkshop } from "./workshop";

/**
 * A Save button that comes back from "Saving…".
 *
 * On Next 16.1.6 a production build sometimes never committed the page a
 * revalidating server action fetched. The work was saved and the fresh page
 * arrived in full, but React never showed it, so a `useActionState` button
 * sat on "Saving…" until somebody reloaded. It showed on documents with a
 * customer or a vehicle and never on a bare cash sale, and only beneath a
 * Suspense boundary: with the dashboard's `loading.tsx` files taken out, none
 * of 400 refreshes stuck. The dev server never showed it.
 *
 * Measured on 23 Nov 2026 with this save repeated, four tests at a time: 81 of
 * 100 saves stuck on 16.1.6, none of 100 on 16.4.6. This spec on its own, one
 * worker, failed five runs out of five on 16.1.6, so it should catch the bug
 * coming back in a later upgrade. It is about the framework, not about
 * MOTION, but this is where a person would have met it.
 */
test.describe("saving", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("a draft with a customer saves again and again without a reload", async ({ page, workshop }) => {
        const id = await inWorkshop(workshop, (tx) =>
            tx.document
                .create({ data: { tenantId: workshop.tenantId, type: "INVOICE", customerId: workshop.customer.id, vehicleId: workshop.vehicle.id }, select: { id: true } })
                .then((d) => d.id),
        );
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/documents/${id}`);

        const save = page.getByRole("button", { name: "Save", exact: true });
        for (let i = 1; i <= 10; i++) {
            await page.getByLabel("Customer order no.").fill(`PO-${i}`);
            await save.click();
            // Back from "Saving…": the action's answer and the refreshed page were both shown.
            await expect(save, `save ${i} came back`).toBeEnabled({ timeout: 8_000 });
        }
        const saved = await inWorkshop(workshop, (tx) => tx.document.findUniqueOrThrow({ where: { id }, select: { customerOrderNumber: true } }));
        expect(saved.customerOrderNumber).toBe("PO-10");
    });
});
