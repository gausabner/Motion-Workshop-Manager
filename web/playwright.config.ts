import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the paths where being wrong costs a workshop money.
 *
 * Everything else in this repo is tested closer in — pure rules as unit tests,
 * anything touching the database with `npm run test:db`. These exist for the
 * one thing neither can see: that a person can actually get from a customer's
 * name to a settled invoice using the screens.
 *
 * They run against a real build on a real Postgres. There is no mocking here;
 * a test that passes against a fake would tell us nothing we want to know.
 */
const PORT = Number(process.env.E2E_PORT ?? 3011);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
    testDir: "./e2e",
    // A workshop's money path touches a dozen screens; 30s each is generous locally and honest on CI.
    timeout: 60_000,
    expect: { timeout: 10_000 },
    // Each spec makes its own workshop, so they cannot tread on one another.
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
    use: {
        baseURL: BASE_URL,
        // Kept only for the run that failed: a trace of a passing test is noise.
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "off",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        // A phone, because this application is used on one and the whole mobile
        // layout was built after a real device showed it did not work. Every
        // defect in that round was found by looking at a narrow screen; nothing
        // in the desktop suite could have caught a single one of them.
        //
        // Chromium rather than the iPhone profile, which needs WebKit: this
        // checks whether the page fits and the navigation is reachable, which
        // is a layout question and identical in both engines. The things that
        // genuinely differ on iOS — input zoom on focus, safe-area insets,
        // sticky hover after a tap — cannot be tested in any headless browser
        // and were confirmed on real hardware instead.
        { name: "phone", use: { ...devices["Pixel 7"] } },
    ],
    webServer: {
        // The production build, not the dev server: these tests should fail if
        // something only works with hot reloading in front of it.
        command: `npm run build && npx next start --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 300_000,
        stdout: "pipe",
        stderr: "pipe",
    },
});
