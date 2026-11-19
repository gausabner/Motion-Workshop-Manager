import { test, expect, signIn, makeCouncil } from "./workshop";
import { violations } from "./axe";

/**
 * One vehicle's route through a council workshop, on its job card: booked in,
 * signed for by reception and the driver, assessed at the check bay, worked
 * on, passed at the quality check, released, and collected. The on-site board
 * shows where it is on the way. Desktop only.
 */

test.describe("fleet route", () => {
    test.beforeEach(({}, testInfo) => {
        test.skip(testInfo.project.name !== "chromium", "desktop Chromium only");
    });

    test("a vehicle goes from reception to collection, one handover at a time", async ({ page, workshop }) => {
        // Generous for a development server compiling each screen on first visit.
        test.setTimeout(240_000);
        const council = await makeCouncil(workshop);
        await signIn(page, workshop);
        const job = `/${workshop.slug}/dashboard/documents/${council.jobId}`;
        await page.goto(job);
        const route = page.locator("section").filter({ has: page.getByRole("heading", { name: "Route" }) });
        const status = (text: RegExp) => expect(route).toContainText(text);
        const shot = (name: string, target: { screenshot: (o: { path: string }) => Promise<unknown> } = page) =>
            process.env.SHOTS_DIR ? target.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` }) : Promise.resolve();

        await expect(route.getByText(/Not booked in yet/)).toBeVisible();
        await page.getByRole("button", { name: "Book in" }).click();
        await status(/At Reception/);

        // Nothing leaves reception unsigned.
        await page.getByRole("button", { name: "Sign as reception" }).click();
        await page.getByLabel("Driver's name").fill("Petrus Amukoto");
        await page.getByLabel("Driver's pay number").fill("PN-77120");
        await page.getByRole("button", { name: "Record the driver's signature" }).click();
        await expect(page.getByRole("cell", { name: "Petrus Amukoto" })).toBeVisible();

        const send = async (to: string) => {
            await route.getByRole("combobox", { name: "Where it goes" }).selectOption({ label: to });
            await route.getByRole("button", { name: "Send it on" }).click();
        };
        await send("Check bay");
        await status(/On its way to Check bay/);
        await page.getByRole("button", { name: "Accept it at Check bay" }).click();
        await status(/At Check bay/);
        // Every control the route offers is on screen here: the send list, the findings, the signature box.
        await expect(page.getByLabel("Assessment findings")).toBeVisible();
        expect(await violations(page, { settle: false })).toEqual([]);
        await shot("route-check-bay", route.locator("xpath=.."));

        // The board shows it where it is.
        await page.goto(`/${workshop.slug}/dashboard/flow?at=${council.checkBay}`);
        await expect(page.getByRole("link", { name: /^JC-/ })).toBeVisible();
        expect(await violations(page, { settle: false })).toEqual([]);
        await shot("on-site");
        await page.goto(job);

        await page.getByLabel("Assessment findings").fill("Service due; rear brakes worn");
        await page.getByRole("button", { name: "Sign as check bay" }).click();
        await expect(page.getByText("Service due; rear brakes worn")).toBeVisible();
        await send("Heavy duty vehicles");
        await page.getByRole("button", { name: "Accept it at Heavy duty vehicles" }).click();
        await status(/At Heavy duty vehicles/);

        await send("Check bay");
        await page.getByRole("button", { name: "Accept it at Check bay" }).click();
        await page.getByRole("radio", { name: "Passed" }).check();
        await page.getByRole("button", { name: "Sign as check bay" }).click();
        await expect(page.getByText("Passed", { exact: true })).toBeVisible();
        await send("Reception");
        await page.getByRole("button", { name: "Accept it at Reception" }).click();
        await status(/At Reception/);

        // Collection: the driver and reception, and the route closes.
        await page.getByLabel("Driver's name").fill("Petrus Amukoto");
        await page.getByRole("button", { name: "Record the driver's signature" }).click();
        await expect(page.getByRole("button", { name: "Sign as reception" })).toBeVisible();
        await page.getByRole("button", { name: "Sign as reception" }).click();
        await status(/Collected/);
        await shot("route-collected", route.locator("xpath=.."));
    });
});
