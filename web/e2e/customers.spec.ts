import { test, expect, signIn } from "./workshop";
import { violations } from "./axe";

/**
 * The customers area, through the screens, the way a workshop is shown it.
 *
 * Written after "New customer" answered "page not found" in front of a
 * prospective customer. An intercepted `(.)customers/[id]` route, added to
 * open a customer over the list, took "new" for a customer id on every
 * in-app link to the form, and turned "Open the full customer" into a loop
 * back into the sheet. Typing the address worked, which is why nothing caught
 * it: these follow the links a person clicks, not the addresses a test types.
 */

test.describe("customers", () => {
    test("New customer opens the form from the list, and saving lands on the customer", async ({ page, workshop }) => {
        test.setTimeout(120_000);
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers`);
        await page.getByRole("link", { name: "New customer" }).first().click();
        await expect(page).toHaveURL(new RegExp(`/${workshop.slug}/dashboard/customers/new$`));
        await expect(page.getByLabel("First name")).toBeVisible();
        expect(await violations(page)).toEqual([]);

        await page.getByLabel("First name").fill("Ndapewa");
        await page.getByLabel("Last name").fill("Iipumbu");
        await page.getByLabel("Mobile (WhatsApp)").fill("+264 81 555 0101");
        await page.getByRole("button", { name: /^Save/ }).first().click();
        await expect(page).toHaveURL(/\/customers\/[a-z0-9]+\?saved=1$/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ndapewa Iipumbu");
    });

    test("a business or fleet account has one name, kept whole", async ({ page, workshop }) => {
        test.setTimeout(120_000);
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers/new`);
        await page.getByLabel("First name").fill("Water and");
        await page.getByText("Business or fleet account").click();
        // What was typed comes across into the one name field.
        await expect(page.getByLabel("Business or department name")).toHaveValue("Water and");
        await expect(page.getByLabel("First name")).toHaveCount(0);
        await page.getByLabel("Business or department name").fill("Water and sanitation");
        await page.getByRole("button", { name: /^Save/ }).first().click();
        await expect(page).toHaveURL(/\/customers\/[a-z0-9]+\?saved=1$/);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Water and sanitation");
        await expect(page.getByLabel("Business or department name")).toHaveValue("Water and sanitation");
    });

    test("a customer opens over the list, and the full customer is one tap on", async ({ page, workshop }) => {
        test.setTimeout(120_000);
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers`);
        await page.getByRole("link", { name: workshop.customer.name }).first().click();
        const sheet = page.getByRole("dialog");
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole("heading", { name: workshop.customer.name })).toBeVisible();
        // The list is still underneath.
        await expect(page.getByRole("heading", { name: /^Customers/ })).toBeAttached();

        await sheet.getByRole("link", { name: "Open the full customer" }).click();
        await expect(page).toHaveURL(new RegExp(`/dashboard/customers/${workshop.customer.id}$`));
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(workshop.customer.name);

        // Back returns to the list with the customer open over it; closing the sheet leaves the list.
        await page.goBack();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("dialog").getByRole("button", { name: /close/i }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`/dashboard/customers$`));
    });

    test("an address that does not exist says so, in MOTION's own page", async ({ page, workshop }) => {
        await signIn(page, workshop);
        await page.goto(`/${workshop.slug}/dashboard/customers/no-such-customer`);
        await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
        await page.goto("/no-such-page");
        await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Go to your workshop" })).toBeVisible();
    });
});
