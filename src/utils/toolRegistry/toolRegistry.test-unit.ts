import { describe, it, expect } from "vitest";
import { toolRegistry } from "./toolRegistry.ts";

describe("toolRegistry", () => {
  it("keys every entry by its own id (no drift)", () => {
    for (const [key, view] of Object.entries(toolRegistry)) expect(view.id).toBe(key);
  });

  it("every tool carries a label key and an accent token", () => {
    for (const view of Object.values(toolRegistry)) {
      expect(view.labelKey).toBeTruthy();
      expect(view.accent).toMatch(/^--s-/); // a Spectrum token, not a raw hex
    }
  });
});
