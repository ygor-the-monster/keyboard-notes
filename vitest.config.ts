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
      exclude: ["src/**/*.test-*.{ts,tsx}", "src/**/*.styled.ts", "src/env.d.ts", "src/main.tsx"],
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test-unit.{ts,tsx}"],
        },
      },
      {
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
