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
 * `settle` waits for the network to go quiet first, which a production build
 * does and a development server, holding its reload connection open, may not.
 * A spec that has already waited for what it needs on screen can skip it.
 */
export async function violations(page: Page, { settle = true }: { settle?: boolean } = {}): Promise<string[]> {
    if (settle) await page.waitForLoadState("networkidle");
    await page.evaluate(AXE);
    const found = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: Violation[] }> } }).axe;
        const result = await axe.run(
            // The development overlay is Next's, not ours, and is absent in production.
            { exclude: [["nextjs-portal"]] },
            { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } },
        );
        return result.violations;
    });
    return found.flatMap((v: Violation) =>
        v.nodes.map((n) => `${v.id} (${v.impact}): ${n.target.join(" ")} — ${(n.failureSummary ?? v.help).split("\n").slice(-1)[0].trim()}`),
    );
}
