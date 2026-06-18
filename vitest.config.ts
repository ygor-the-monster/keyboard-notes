import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import macros from "unplugin-parcel-macros";

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
          setupFiles: ["./test/setup-unit.ts"],
          include: ["src/**/*.test-unit.{ts,tsx}"],
        },
      },
      {
        // Compiles the S2 `style` macro (used in *.styled.ts) for components imported by browser
        // tests. Project-level so it actually runs (root plugins don't propagate into projects);
        // without it the uncompiled macro calls Node's fileURLToPath and crashes in the browser.
        plugins: [macros.vite()],
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
