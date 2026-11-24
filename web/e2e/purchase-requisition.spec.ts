import type { Page } from "@playwright/test";
import { test, expect, signInAs, makeCouncil, addPerson, inWorkshop } from "./workshop";
import { violations } from "./axe";

/**
 * Buying what stores cannot issue, through the screens: stores splits an
 * approved requisition's shortfall into a purchase requisition; a parts
 * driver asks a supplier by email, adds the quotation and sends it on; the
 * foreman and the divisional head approve; stores raises the purchase order,
 * the goods arrive on the supplier invoice, and stores hands them over.
 * Desktop only.
 */

test.describe("purchase requisition", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("split from stores, quoted, approved, ordered, received and handed over", async ({ page, workshop }) => {
        test.setTimeout(240_000);
        const council = await makeCouncil(workshop);
        const mechanic = await addPerson(workshop, "mechanic", { firstName: "Tobias", lastName: "Kandjii", group: "MECHANIC", designations: ["MECHANIC"], payNumber: "PN-15561" });
        const head = await addPerson(workshop, "head", { firstName: "Elago", lastName: "Mwandingi", group: "FOREMAN", designations: ["DIVISION_HEAD"], payNumber: "PN-09012" });
        const storeman = await addPerson(workshop, "storeman", { firstName: "Hilma", lastName: "Nakale", group: "PARTS_MANAGER", designations: ["STOREMAN"], payNumber: "PN-16034" });
        const driver = await addPerson(workshop, "driver", { firstName: "Petrus", lastName: "Haufiku", group: "MECHANIC", designations: ["PARTS_DRIVER"], payNumber: "PN-14420" });
        const owner = { email: workshop.email, password: workshop.password };

        // An approved stores requisition on the job: one gasket on the shelf of the three asked for, and a bearing stores does not keep.
        const stores = await inWorkshop(workshop, async (tx) => {
            const t = workshop.tenantId;
            const unit = await tx.orgUnit.findFirstOrThrow({ where: { tenantId: t }, select: { id: true } });
            await tx.signingAuthority.create({ data: { tenantId: t, kind: "DIVISION_HEAD", orgUnitId: unit.id, membershipId: head.membershipId } });
            await tx.supplier.create({ data: { tenantId: t, companyName: "Windhoek Bearings and Seals", email: "sales@bearings.example.invalid" } });
            const gasket = await tx.product.create({ data: { tenantId: t, itemCode: "FL-ATG-PG", description: "Pump gearbox gasket set", type: "STOCK", qtyOnHand: 1, costExTax: "760.00", retailPrice: "1100.00" } });
            await tx.document.update({ where: { id: council.jobId }, data: { jobStatus: "WAITING_FOR_PARTS" } });
            const ownerId = (await tx.membership.findFirstOrThrow({ where: { tenantId: t, group: "OWNER" }, select: { id: true } })).id;
            const at = (m: number) => new Date(Date.now() - m * 60_000);
            const req = await tx.requisition.create({
                data: {
                    tenantId: t, number: "REQ-9001", kind: "STORES", state: "APPROVED", workshopId: council.heavy, requestedById: mechanic.membershipId, chargeDocumentId: council.jobId,
                    purpose: "Pump gearbox noise", value: "4840.00", submittedAt: at(30), approvedAt: at(10),
                    lines: {
                        create: [
                            { tenantId: t, sortOrder: 0, productId: gasket.id, itemCode: "FL-ATG-PG", description: "Pump gearbox gasket set", quantity: 3, unitCost: "760.00" },
                            { tenantId: t, sortOrder: 1, description: "Output bearing, SKF 6310", quantity: 2, unitCost: "1280.00" },
                        ],
                    },
                    signoffs: {
                        create: [
                            { tenantId: t, step: "REQUESTED", decision: "SUBMITTED", membershipId: mechanic.membershipId, name: "Tobias Kandjii", role: "Requisitioned by", payNumber: "PN-15561", value: "4840.00", at: at(30) },
                            { tenantId: t, step: "FOREMAN", decision: "APPROVED", membershipId: ownerId, name: "Owner", role: "Foreman", payNumber: "PN-10001", value: "4840.00", at: at(20) },
                            { tenantId: t, step: "DIVISIONAL_HEAD", decision: "APPROVED", membershipId: head.membershipId, name: "Elago Mwandingi", role: "Divisional Head", payNumber: "PN-09012", value: "4840.00", at: at(10) },
                        ],
                    },
                },
                select: { id: true },
            });
            return req.id;
        });
        const base = `/${workshop.slug}/dashboard/requisitions`;
        const state = (page: Page, text: RegExp) => expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(text);
        const said = (page: Page, text: RegExp) => expect(page.getByRole("status").filter({ hasText: text })).toBeFocused();

        // Stores hands over the one gasket on the shelf, then splits what it cannot meet: two gaskets short, and the bearing.
        await signInAs(page, workshop, storeman);
        await page.goto(`${base}/${stores}`);
        await expect(page.getByLabel("Issue now: Pump gearbox gasket set")).toHaveValue("1");
        await page.getByRole("button", { name: "Issue", exact: true }).click();
        await expect(page.getByText("Hand 1 × Pump gearbox gasket set to Tobias Kandjii (PN-15561).")).toBeVisible();
        await page.getByRole("button", { name: "Confirm the issue" }).click();
        await said(page, /^Issued\./);
        await expect(page.getByRole("listitem").filter({ hasText: "Stores verified" }).filter({ hasText: "PN-16034" })).toBeVisible();
        await expect(page.getByRole("listitem").filter({ hasText: "To be bought" })).toContainText("2 × Pump gearbox gasket set; 2 × Output bearing, SKF 6310");
        await page.getByRole("button", { name: "Raise a purchase requisition for these" }).click();
        await page.waitForURL((url) => !url.pathname.endsWith(stores));
        const purchase = page.url();
        await state(page, /Waiting for quotations/);
        await expect(page.getByRole("link", { name: "REQ-9001" })).toBeVisible();

        // The parts driver finds it on their list, asks the supplier, adds the quotation and sends it on.
        await signInAs(page, workshop, driver);
        await page.goto(base);
        await expect(page.getByRole("link", { name: "Quotations 1" })).toHaveAttribute("aria-current", "page");
        await page.getByRole("link", { name: /^REQ-/ }).click();
        await page.getByRole("button", { name: "Ask suppliers by email" }).click();
        await page.getByRole("checkbox", { name: /Windhoek Bearings and Seals/ }).check();
        await page.getByRole("button", { name: "Prepare the emails" }).click();
        await expect(page.getByRole("link", { name: "Email Windhoek Bearings and Seals" })).toHaveAttribute("href", /^mailto:sales%40bearings\.example\.invalid\?subject=Request%20for%20quotation%20REQ-/);
        await page.getByLabel("Supplier").selectOption({ label: "Windhoek Bearings and Seals" });
        await page.getByLabel(/Amount excl\. VAT/).fill("4100");
        await page.getByLabel("Their reference").fill("Q-5521");
        await page.getByRole("button", { name: "Add the quotation" }).click();
        await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Quotations", exact: true }) })).toContainText("1 of 1 quotation");
        await page.waitForTimeout(400);
        expect(await violations(page, { settle: false })).toEqual([]);
        await page.getByRole("button", { name: "Submit for approval" }).click();
        await state(page, /Waiting for the foreman/);
        await said(page, /^Submitted\. Waiting on /);

        // The foreman and the divisional head approve the chosen quotation.
        await signInAs(page, workshop, owner);
        await page.goto(purchase);
        await expect(page.getByRole("listitem").filter({ hasText: "Quotation chosen" })).toContainText("Windhoek Bearings and Seals");
        await page.getByRole("button", { name: "Approve" }).click();
        await state(page, /Waiting for the divisional head/);
        await signInAs(page, workshop, head);
        await page.goto(purchase);
        await page.getByRole("button", { name: "Approve" }).click();
        await state(page, /Approved, to be ordered/);

        // Stores orders it, and receives it on the supplier invoice.
        await signInAs(page, workshop, storeman);
        await page.goto(purchase);
        await page.getByRole("button", { name: "Raise the purchase order" }).click();
        await state(page, /On order/);
        await page.getByRole("link", { name: /^Open PO-/ }).click();
        await page.getByRole("button", { name: "Goods arrived" }).click();
        await page.waitForURL("**/purchasing/invoices/**");
        await page.getByLabel("Their invoice number").fill("INV-88102");
        await page.getByRole("button", { name: "Put on the shelf" }).click();
        await expect
            .poll(() => inWorkshop(workshop, async (tx) => (await tx.supplierInvoice.findFirst({ select: { state: true } }))?.state), { timeout: 20_000 })
            .toBe("PROCESSED");

        // What arrived is handed over: the gaskets from the shelf, the bearing straight from the delivery.
        await page.goto(purchase);
        await state(page, /Arrived, to be handed over/);
        await expect(page.getByLabel("Issue now: Pump gearbox gasket set")).toHaveValue("2");
        await expect(page.getByLabel("Issue now: Output bearing, SKF 6310")).toHaveValue("2");
        await page.getByRole("button", { name: "Issue", exact: true }).click();
        await page.getByRole("button", { name: "Confirm the issue" }).click();
        await state(page, /Issued, to be finalised/);
        await page.goto(`/${workshop.slug}/dashboard/documents/${council.jobId}`);
        // Both requisitions are met, so the job is back in work. A council job's status shows where the vehicle is, not "Work in progress".
        await expect(page.getByRole("group", { name: "Status" })).toBeVisible();
        await expect(page.getByRole("group", { name: "Status" })).not.toContainText("Waiting for parts");
        await expect(page.getByRole("listitem").filter({ hasText: "Every requisition for parts has been met." })).toContainText("Waiting for parts → Work in progress");
        if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/purchase.png`, fullPage: true });
    });
});
