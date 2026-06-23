import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Three test kinds, split by filename:
//   *.test-unit.ts     — fast, pure logic in jsdom
//   *.test-browser.ts  — real Chromium (canvas + Web Audio + pdf, which jsdom can't run)
//   *.test-type.ts     — type-level assertions, checked by tsgo via `npm run typecheck`
// (type tests aren't run by the vitest runtime; they're verified at type-check time.)
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test-*.{ts,tsx}", "src/env.d.ts", "src/main.tsx"],
      // A ratchet, not a target: set a few points below the current combined (unit + browser)
      // coverage so it can only go up. Raise these as coverage climbs; never lower them.
      thresholds: {
        statements: 45,
        branches: 36,
        functions: 39,
        lines: 47,
      },
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./test/setup-unit.ts"],
          include: ["src/**/*.test-unit.{ts,tsx}"],
        },
      },
      {
        // React Aria hooks (e.g. useMove in Cell) must share ONE React instance with the test
        // renderer; without deduping + pre-bundling, the browser optimizer hands react-aria a second
        // React and its hooks hit a null dispatcher.
        resolve: { dedupe: ["react", "react-dom"] },
        optimizeDeps: { include: ["react-aria", "react", "react-dom"] },
        test: {
          name: "browser",
          include: ["src/**/*.test-browser.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          name: "types",
          include: [],
          typecheck: {
            enabled: true,
            checker: "tsgo",
            include: ["src/**/*.test-type.ts"],
            tsconfig: "tsconfig.json",
          },
        },
      },
    ],
  },
});
