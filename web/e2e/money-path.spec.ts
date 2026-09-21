import { test, expect, signIn, bookEntry } from "./workshop";

/**
 * The path the whole business rests on: a customer's name to money in the
 * bank. An invoice raised, processed, and settled by a payment.
 *
 * Every piece of this is tested closer in — totals and tax as pure rules,
 * settlement against a real database. What only this can see is whether a
 * person can actually walk it using the screens, and whether the numbers the
 * screens show are the ones the rules worked out.
 */

test("an invoice is raised, processed and settled", async ({ page, workshop }) => {
    await signIn(page, workshop);

    // ── raise and process it ──────────────────────────────────────────────
    await page.goto(`/${workshop.slug}/dashboard/transactions`);
    await page.getByRole("button", { name: "Invoice" }).click();
    await page.waitForURL("**/documents/**");

    await page.getByPlaceholder("Name, mobile, email or plate…").fill("Anna");
    await page.getByRole("option", { name: /Shilongo, Anna/ }).first().click();

    // With a customer chosen the picker narrows to that customer's cars, so the
    // one we want is simply there — no searching for it.
    await page.getByRole("combobox", { name: "Vehicle" }).click();
    await page
        .getByRole("listbox", { name: "Vehicle" })
        .getByRole("option", { name: new RegExp(workshop.vehicle.plate.replace(/ /g, "\\s*"), "i") })
        .first()
        .click();

    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel("Description, line 1").fill("Minor service (oil & filter)");
    await page.getByLabel("Quantity, line 1").fill("1");
    await page.getByLabel("Unit price, line 1").fill("650");
    await page.getByRole("button", { name: "Save" }).click();

    // Prices include tax in Namibia, so N$650 on the line is N$650 to pay.
    await expect(page.getByText("650.00").first()).toBeVisible();

    await page.getByRole("button", { name: "Process", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /Process this invoice/i })).toBeVisible();

    // Processing asks the questions that only get asked once, and will not go
    // ahead without them: the reading on this invoice is what the car's next
    // service is worked out from.
    await page.getByRole("button", { name: "Process invoice" }).click();
    await expect(page.getByText(/check the highlighted answers/i)).toBeVisible();

    await page.getByRole("textbox", { name: /^Odometer/ }).fill("88500");
    await page.getByRole("button", { name: "Process invoice" }).click();

    // Processing is what gives it a number; a draft has none.
    await expect(page.getByText(/INV-1001/).first()).toBeVisible({ timeout: 20_000 });

    // ── settle it ─────────────────────────────────────────────────────────
    await page.getByRole("button", { name: "Take payment" }).click();
    await page.waitForURL("**/payments/**");

    // The receipt arrives knowing what it is for: the invoice that sent us here,
    // the amount outstanding on it, and the workshop's first payment method.
    await expect(page.getByText(/INV-1001/).first()).toBeVisible();
    await expect(page.getByLabel("Amount applied to INV-1001")).toHaveValue("650");

    await page.getByRole("button", { name: "Post receipt" }).click();
    // Wait for the receipt to say it posted, rather than for the draft badge to
    // go: a badge disappearing is also what a re-render looks like mid-flight.
    await expect(page.getByText(/Posted as RC-1001/)).toBeVisible({ timeout: 30_000 });

    // ── and the books agree ───────────────────────────────────────────────
    // Asked of the ledger rather than of a cell of text, because "650.00" would
    // satisfy a lazy match for "0.00" and prove nothing at all. `paid` is summed
    // from the allocation here exactly as the app derives it: never stored.
    const entry = await bookEntry(workshop.tenantId, "INV-1001");
    expect(entry.total).toBe("650.00");
    expect(entry.paid).toBe("650.00");
    expect(entry.state).toBe("CLOSED");

    await page.goto(`/${workshop.slug}/dashboard/transactions`);
    await expect(page.getByRole("row", { name: /INV-1001/ })).toContainText("650.00");
});
