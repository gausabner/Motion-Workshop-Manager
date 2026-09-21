import { test, expect, signIn } from "./workshop";

/**
 * The door. Everything else assumes a person got through it, and one workshop
 * must never open another's.
 */

test("an owner signs in and lands in their own workshop", async ({ page, workshop }) => {
    await signIn(page, workshop);
    await expect(page).toHaveURL(new RegExp(`/${workshop.slug}/dashboard`));
    await expect(page.getByRole("heading", { name: workshop.name })).toBeVisible();
});

test("a wrong password does not get in, and does not say which half was wrong", async ({ page, workshop }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(workshop.email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
    // Telling somebody the email exists is telling them half the answer.
    await expect(page.getByText(/email or password/i)).toBeVisible();
});

test("signing out ends it — the dashboard is not reachable afterwards", async ({ page, workshop }) => {
    await signIn(page, workshop);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    await page.goto(`/${workshop.slug}/dashboard`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
});

test("a signed-out visitor is sent to sign in, and back where they were going", async ({ page, workshop }) => {
    await page.goto(`/${workshop.slug}/dashboard/customers`);
    await expect(page).toHaveURL(/\/login\?next=/);
    expect(decodeURIComponent(page.url())).toContain(`/${workshop.slug}/dashboard/customers`);
});
