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
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
