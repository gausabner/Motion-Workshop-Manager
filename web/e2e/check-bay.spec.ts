import { test, expect, signIn, makeCouncil, makeCheckBay } from "./workshop";

/**
 * The check bay's two inspections, through the screens: the assessment is
 * started from the job card, worked through on the inspection screen, and
 * signed back on the job card with its finding becoming the work. The
 * quality check fails on a red item and sends the vehicle back in one press;
 * after the fix, a clean one passes. Desktop only.
 */

test.describe("check bay", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("the assessment and the quality check are inspections, signed with what they found", async ({ page, workshop }) => {
        // Generous for a development server compiling each screen on first visit.
        test.setTimeout(240_000);
        const council = await makeCouncil(workshop);
        await makeCheckBay(workshop);
        await signIn(page, workshop);
        const job = `/${workshop.slug}/dashboard/documents/${council.jobId}`;
        await page.goto(job);
        const route = page.locator("section").filter({ has: page.getByRole("heading", { name: "Route" }) });
        const signatures = page.locator("section").filter({ has: page.getByRole("heading", { name: "Job card signatures" }) });
        const status = (text: RegExp) => expect(route).toContainText(text);
        const send = async (to: string) => {
            await route.getByRole("combobox", { name: "Where it goes" }).selectOption({ label: to });
            await route.getByRole("button", { name: "Send it on" }).click();
        };
        const accept = async (at: string) => {
            await route.getByRole("button", { name: `Accept it at ${at}` }).click();
            await status(new RegExp(`At ${at}`));
        };
        /** On the inspection screen: mark each item, wait for the save, and go back to sign. */
        const inspect = async (what: "assessment" | "quality check", marks: [string, "OK" | "Soon" | "Urgent", string?][]) => {
            await page.waitForURL("**/inspections/**");
            await expect(page.getByText(`The check bay’s ${what}`)).toBeVisible();
            for (const [item, mark, comment] of marks) {
                await page.getByRole("radiogroup", { name: `${item} condition` }).getByRole("radio", { name: mark }).click();
                if (comment) await page.getByRole("article").filter({ hasText: item }).getByRole("textbox").first().fill(comment);
            }
            await expect(page.getByText("All changes saved")).toBeVisible();
            await page.getByRole("link", { name: `Sign the ${what} on the job card` }).click();
            await page.waitForURL(`**${job}`);
        };

        await page.getByRole("button", { name: "Book in" }).click();
        await status(/At Reception/);
        await page.getByRole("button", { name: "Sign as reception" }).click();
        await page.getByLabel("Driver's name").fill("Petrus Amukoto");
        await page.getByRole("button", { name: "Record the driver's signature" }).click();
        await expect(page.getByRole("cell", { name: "Petrus Amukoto" })).toBeVisible();
        await send("Check bay");
        await accept("Check bay");

        // The assessment: one urgent finding, which becomes the job card's work.
        await signatures.getByRole("button", { name: "Start the assessment" }).click();
        await inspect("assessment", [["Brakes", "Urgent", "Pads at 2 mm"], ["Hydraulics", "OK"]]);
        await expect(signatures.getByText(/1 finding goes onto the job card/)).toBeVisible();
        await signatures.getByRole("button", { name: "Sign the assessment" }).click();
        await expect(signatures.getByText("1 urgent: Brakes: Pads at 2 mm")).toBeVisible();
        await page.reload();
        await expect(page.getByRole("textbox", { name: "Description, line 1" })).toHaveValue("Brakes — Pads at 2 mm");

        // The work, then a quality check with a red item: failed, and back to the workshop in one press.
        await send("Heavy duty vehicles");
        await accept("Heavy duty vehicles");
        await send("Check bay");
        await accept("Check bay");
        await signatures.getByRole("button", { name: "Start the quality check" }).click();
        await inspect("quality check", [["Wheel nuts torqued", "Urgent", "Two nuts loose"], ["No new damage", "OK"]]);
        await expect(signatures.getByText(/Failed:/)).toBeVisible();
        await signatures.getByRole("button", { name: "Fail it and send it back to Heavy duty vehicles" }).click();
        await status(/On its way to Heavy duty vehicles/);
        await expect(signatures.getByText("Wheel nuts torqued: Two nuts loose")).toBeVisible();
        await expect(route.getByText("Failed: Wheel nuts torqued: Two nuts loose")).toBeVisible();

        // Put right, checked again, and passed.
        await accept("Heavy duty vehicles");
        await send("Check bay");
        await accept("Check bay");
        await signatures.getByRole("button", { name: "Start the quality check" }).click();
        await inspect("quality check", [["Wheel nuts torqued", "OK"], ["No new damage", "OK"]]);
        await signatures.getByRole("button", { name: "Pass it" }).click();
        await expect(signatures.getByText("2 items checked")).toBeVisible();
        await send("Reception");
        await status(/On its way to Reception/);
        if (process.env.SHOTS_DIR) await route.locator("xpath=..").screenshot({ path: `${process.env.SHOTS_DIR}/check-bay.png` });
    });
});
