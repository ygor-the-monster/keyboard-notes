import { defineConfig } from "vitest/config";

// Standalone test config (kept separate from vite.config.js so the PWA / S2 macro plugins
// don't run during unit tests). jsdom gives us document/FileReader for the DOM-touching utils;
// canvas / Web Audio aren't implemented in jsdom, so those paths aren't unit-tested here.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/**/*.styled.ts", "src/env.d.ts", "src/main.tsx"],
    },
  },
});
