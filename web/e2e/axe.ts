import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

/**
 * WCAG 2.2 AA as axe reads it, for any spec that wants to check the screen it
 * is on. axe sees what is rendered, not what a person can do: a pass is the
 * floor, not the verdict.
 */

const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

type Violation = { id: string; impact: string | null; help: string; nodes: { target: string[]; failureSummary?: string }[] };

/**
 * Structure the WCAG tags leave to "best practice": a screen with no heading to
 * jump to, a level skipped, two landmarks a screen reader cannot tell apart.
 * The 21 November critique found four list screens with no heading at all
 * while this suite passed, so they are checked by name as well.
 */
const STRUCTURE = ["page-has-heading-one", "heading-order", "landmark-unique", "landmark-one-main", "landmark-no-duplicate-main"];

/**
 * `settle` waits for the network to go quiet first, which a production build
 * does and a development server, holding its reload connection open, may not.
 * A spec that has already waited for what it needs on screen can skip it.
 */
export async function violations(page: Page, { settle = true }: { settle?: boolean } = {}): Promise<string[]> {
    if (settle) await page.waitForLoadState("networkidle");
    await page.evaluate(AXE);
    const found = await page.evaluate(async (rules: string[]) => {
        const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: Violation[] }> } }).axe;
        // The development overlay is Next's, not ours, and is absent in production.
        const context = { exclude: [["nextjs-portal"]] };
        const wcag = await axe.run(context, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        const structure = await axe.run(context, { runOnly: { type: "rule", values: rules } });
        return [...wcag.violations, ...structure.violations];
    }, STRUCTURE);
    return found.flatMap((v: Violation) =>
        v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")} — ${(n.failureSummary ?? v.help).split("\n").slice(-1)[0].trim()}`),
    );
}
