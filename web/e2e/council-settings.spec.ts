import { test, expect, signIn } from "./workshop";

/**
 * A council setting itself up for requisitions, through the screens: its
 * organisation two levels deep, a divisional head, votes pasted from the
 * finance system, a workshop with its foreman, its own approval figures, and
 * the designations and pay numbers its people sign under.
 *
 * Desktop only; the screens are the same at every width. Set SHOTS_DIR to keep
 * a screenshot of each one.
 */

const shot = async (page: import("@playwright/test").Page, name: string) => {
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png`, fullPage: true });
};

test.describe("council settings", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("a council sets up its organisation, workshop, rules and people", async ({ page, workshop }) => {
        // Generous for a development server compiling each screen on first visit; a production build takes a fraction of it.
        test.setTimeout(240_000);
        await signIn(page, workshop);
        const settings = (path: string) => page.goto(`/${workshop.slug}/dashboard/settings/${path}`);

        // The organisation: a division, a department under it, and who heads it.
        await settings("organisation");
        await expect(page.getByText(/No units yet/)).toBeVisible();
        const addUnit = async (name: string, under?: string) => {
            await page.getByRole("button", { name: "Add", exact: true }).first().click();
            const form = page.locator("form").filter({ has: page.getByPlaceholder(/Name of the division/) });
            await form.getByPlaceholder(/Name of the division/).fill(name);
            if (under) await form.getByRole("combobox", { name: "Where it sits" }).selectOption({ label: `A department under ${under}` });
            await form.getByRole("button", { name: "Add", exact: true }).click();
            await expect(page.locator(`input[aria-label="Unit name"][value="${name}"]`)).toBeVisible();
        };
        await addUnit("Technical Services");
        await addUnit("Fleet Management", "Technical Services");
        const appoint = page.locator("form").filter({ has: page.getByRole("combobox", { name: "What they sign as" }) });
        await appoint.getByRole("combobox", { name: "The unit" }).selectOption({ label: "Technical Services" });
        await appoint.getByRole("combobox", { name: "Person" }).selectOption({ index: 1 });
        await appoint.getByRole("button", { name: "Appoint" }).click();
        await expect(page.getByText("Divisional Head", { exact: true }).first()).toBeVisible();

        // Votes, pasted as the finance system exports them.
        await page.getByRole("button", { name: "Import", exact: true }).click();
        await page.locator("#vote-csv").fill("2000025105010,Protective clothing,Fleet Management\n2000025105020,Vehicle parts,Technical Services / Fleet Management");
        await page.locator("form").filter({ has: page.locator("#vote-csv") }).getByRole("button", { name: "Import", exact: true }).click();
        await expect(page.getByText("2 added, 0 updated.")).toBeVisible();
        await expect(page.locator('input[aria-label="Vote number"][value="2000025105010"]')).toBeVisible();
        await shot(page, "organisation");

        // A workshop, run by the department, and its foreman.
        await settings("workshops");
        await page.getByRole("button", { name: "Add", exact: true }).first().click();
        const line = page.locator("form").filter({ has: page.getByPlaceholder("e.g. Heavy duty vehicles") });
        await line.getByPlaceholder("e.g. Heavy duty vehicles").fill("Heavy duty vehicles");
        await line.getByRole("combobox", { name: "Run by" }).selectOption({ label: "Technical Services / Fleet Management" });
        await line.getByRole("button", { name: "Add", exact: true }).click();
        await expect(page.getByText(/Nothing from here can be approved until one is appointed/)).toBeVisible();
        const foreman = page.locator("form").filter({ has: page.getByRole("combobox", { name: "Workshop" }) });
        await foreman.getByRole("combobox", { name: "Workshop" }).selectOption({ label: "Heavy duty vehicles" });
        await foreman.getByRole("combobox", { name: "Person" }).selectOption({ index: 1 });
        await foreman.getByRole("button", { name: "Appoint" }).click();
        await expect(page.getByText(/Nothing from here can be approved/)).toHaveCount(0);
        await shot(page, "workshops");

        // The council's own figures, and who approves above the limit.
        await settings("requisitions");
        await page.getByLabel(/Value limit, excluding VAT/).fill("50000");
        await page.getByLabel("Band 2 from").fill("10000");
        await page.getByLabel("Band 2 quotations").fill("3");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
        await page.reload();
        await expect(page.getByLabel(/Value limit, excluding VAT/)).toHaveValue("50000");
        await expect(page.getByLabel("Band 2 quotations")).toHaveValue("3");
        await page.getByRole("combobox", { name: "Person" }).selectOption({ index: 1 });
        await page.getByRole("button", { name: "Appoint" }).click();
        await expect(page.getByText(/Nobody yet/)).toHaveCount(0);
        await shot(page, "requisition-rules");

        // The designations and pay number the owner signs under.
        await settings("users");
        const me = page.locator("form").filter({ has: page.getByRole("group", { name: /Designations for/ }) }).first();
        await me.getByRole("checkbox", { name: "Foreman" }).check();
        await me.getByRole("checkbox", { name: "Fleet Coordinator" }).check();
        await me.getByLabel("Pay No.").fill("PN-20431");
        await me.getByRole("button", { name: "Save", exact: true }).click();
        await expect(me.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
        await page.reload();
        await expect(page.locator("form").filter({ has: page.getByRole("group", { name: /Designations for/ }) }).first().getByLabel("Pay No.")).toHaveValue("PN-20431");
        await shot(page, "team");
    });
});
