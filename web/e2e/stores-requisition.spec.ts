import type { Page } from "@playwright/test";
import { test, expect, signInAs, makeCouncil, addPerson, inWorkshop } from "./workshop";
import { violations } from "./axe";

/**
 * A stores requisition through the screens, by the five people the paper
 * form passes through: the mechanic asks for parts on the job card; the
 * foreman and the divisional head approve; stores issues them to the
 * mechanic; the parts are on the job card at cost; and the foreman, the
 * fleet coordinator and the divisional head finalise it. Desktop only.
 */

test.describe("stores requisition", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("parts asked for on the job card, approved, issued from stores and finalised", async ({ page, workshop }) => {
        test.setTimeout(240_000);
        const council = await makeCouncil(workshop);
        const mechanic = await addPerson(workshop, "mechanic", { firstName: "Tobias", lastName: "Kandjii", group: "MECHANIC", designations: ["MECHANIC"], payNumber: "PN-15561" });
        const head = await addPerson(workshop, "head", { firstName: "Elago", lastName: "Mwandingi", group: "FOREMAN", designations: ["DIVISION_HEAD"], payNumber: "PN-09012" });
        const storeman = await addPerson(workshop, "storeman", { firstName: "Hilma", lastName: "Nakale", group: "PARTS_MANAGER", designations: ["STOREMAN"], payNumber: "PN-16034" });
        const coordinator = await addPerson(workshop, "coordinator", { firstName: "Ndapewa", lastName: "Shikongo", group: "FOREMAN", designations: ["FLEET_COORDINATOR"], payNumber: "PN-12008" });
        // The head and the coordinator answer for the unit the workshops belong to; a stock item on the shelf.
        await inWorkshop(workshop, async (tx) => {
            const unit = await tx.orgUnit.findFirstOrThrow({ where: { tenantId: workshop.tenantId }, select: { id: true } });
            await tx.signingAuthority.create({ data: { tenantId: workshop.tenantId, kind: "DIVISION_HEAD", orgUnitId: unit.id, membershipId: head.membershipId } });
            await tx.signingAuthority.create({ data: { tenantId: workshop.tenantId, kind: "FLEET_COORDINATOR", orgUnitId: unit.id, membershipId: coordinator.membershipId } });
            await tx.product.create({ data: { tenantId: workshop.tenantId, itemCode: "BP-HD-01", description: "Brake pads, heavy duty, axle set", type: "STOCK", qtyOnHand: 10, costExTax: "1200.00", retailPrice: "1800.00" } });
            await tx.document.update({ where: { id: council.jobId }, data: { jobStatus: "WORK_IN_PROGRESS" } });
        });
        const job = `/${workshop.slug}/dashboard/documents/${council.jobId}`;
        const owner = { email: workshop.email, password: workshop.password };
        const state = (page: Page, text: RegExp) => expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText(text);
        // After a box is signed the page says so, with who it waits on next, and the cursor goes there.
        const said = (page: Page, text: RegExp) => expect(page.getByRole("status").filter({ hasText: text })).toBeFocused();

        // The mechanic asks for parts on the job card.
        await signInAs(page, workshop, mechanic);
        await page.goto(job);
        await page.getByRole("button", { name: "Request parts" }).click();
        await page.waitForURL("**/requisitions/**");
        const requisition = page.url();
        await page.getByLabel("Workshop asking").selectOption({ label: "Heavy duty vehicles" });
        await page.getByLabel("Item code, line 1").fill("BP-HD-01");
        await page.getByLabel("Quantity, line 1").click();
        await expect(page.getByLabel("Description, line 1")).toHaveValue("Brake pads, heavy duty, axle set");
        // A quantity that is not a number is said beside it at once.
        await page.getByLabel("Quantity, line 1").fill("two");
        await expect(page.getByLabel("Quantity, line 1")).toHaveAttribute("aria-invalid", "true");
        await page.getByLabel("Quantity, line 1").fill("2");
        await expect(page.getByText("10 on hand in stores")).toBeVisible();
        await page.getByRole("button", { name: "Save draft" }).click();
        await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Submit for approval" })).toBeEnabled();
        await page.waitForTimeout(400);
        expect(await violations(page, { settle: false })).toEqual([]);
        await page.getByRole("button", { name: "Submit for approval" }).click();
        await state(page, /Waiting for the foreman/);
        await said(page, /^Submitted\. Waiting on /);
        await page.goto(job);
        await expect(page.getByRole("group", { name: "Status" })).toContainText("Waiting for parts");

        // The foreman, then the divisional head, approve.
        await signInAs(page, workshop, owner);
        await page.goto(`/${workshop.slug}/dashboard/requisitions`);
        await page.getByRole("link", { name: /^REQ-/ }).click();
        // The ledger shows every box to come; the foreman's is the one due, and is signed in its own row.
        await expect(page.getByRole("listitem").filter({ hasText: "Divisional Head" }).first()).toContainText("Elago Mwandingi");
        await page.getByRole("button", { name: "Approve" }).click();
        await state(page, /Waiting for the divisional head/);
        await said(page, /^Approved\. Waiting on Elago Mwandingi\.$/);
        await signInAs(page, workshop, head);
        await page.goto(requisition);
        await page.getByRole("button", { name: "Approve" }).click();
        await state(page, /Approved, to be issued/);

        // Stores issues them to the mechanic.
        await signInAs(page, workshop, storeman);
        await page.goto(`/${workshop.slug}/dashboard/requisitions?show=issue`);
        await page.getByRole("link", { name: /^REQ-/ }).click();
        await expect(page.getByLabel(/Issue now: Brake pads/)).toHaveValue("2");
        // The parts go to whoever asked unless stores says otherwise.
        await expect(page.getByLabel("Received by")).toHaveValue(mechanic.membershipId);
        expect(await violations(page, { settle: false })).toEqual([]);
        await page.getByRole("button", { name: "Issue", exact: true }).click();
        // Nothing leaves the shelf until stores has read back what goes to whom.
        await expect(page.getByText("Hand 2 × Brake pads, heavy duty, axle set to Tobias Kandjii (PN-15561).")).toBeVisible();
        expect(await violations(page, { settle: false })).toEqual([]);
        await page.getByRole("button", { name: "Confirm the issue" }).click();
        await state(page, /Issued, to be finalised/);
        await said(page, /^Issued\. Waiting on the foreman, the fleet coordinator and the divisional head to sign\.$/);
        // The storeman's verification is a box with a pay number, like every other.
        await expect(page.getByRole("listitem").filter({ hasText: "Stores verified" })).toContainText("PN-16034");
        await expect(page.getByText("2 × Brake pads, heavy duty, axle set", { exact: true })).toBeVisible();

        // On the job card, at cost, and no longer waiting for parts.
        await page.goto(job);
        await expect(page.getByRole("textbox", { name: "Description, line 1" })).toHaveValue("Brake pads, heavy duty, axle set");
        await expect(page.getByRole("group", { name: "Status" })).toBeVisible();
        await expect(page.getByRole("group", { name: "Status" })).not.toContainText("Waiting for parts");

        // Finalised by the three who must sign.
        for (const [who, box] of [[owner, "Sign as foreman"], [coordinator, "Sign as fleet coordinator"], [head, "Sign as divisional head"]] as const) {
            await signInAs(page, workshop, who);
            await page.goto(requisition);
            await page.getByRole("button", { name: box }).click();
            // Signed: the box leaves this person's screen, and the signature joins the trail.
            await expect(page.getByRole("button", { name: box })).toHaveCount(0);
        }
        await state(page, /Closed/);
        if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/requisition.png`, fullPage: true });
    });
});
