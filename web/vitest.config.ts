import path from "node:path";
import { defineConfig } from "vitest/config";

// Component tests only: `*.ui.test.tsx`, rendered in jsdom. The rule tests
// (`*.test.ts`) stay on node:test, and the database tests on `npm run test:db`.
export default defineConfig({
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    esbuild: { jsx: "automatic" },
    test: {
        environment: "jsdom",
        include: ["src/**/*.ui.test.tsx"],
        setupFiles: ["./src/test/ui-setup.ts"],
        css: false,
    },
});
