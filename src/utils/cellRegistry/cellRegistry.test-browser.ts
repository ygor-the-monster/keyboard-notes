import { describe, it, expect } from "vitest";
import { cellRegistry, ADD_BAR_ORDER } from "./cellRegistry.tsx";
import { KINDS } from "../cellKinds/cellKinds.ts";

// The registry is typed Record<Kind, CellView>, so a missing kind is already a compile error.
// These runtime checks guard the *shape* of each entry (component/icon/keys/hue) and that the
// AddBar order stays a permutation of KINDS — things types alone don't enforce.
describe("cellRegistry", () => {
  it("has a complete, well-formed view entry for every Kind", () => {
    for (const kind of KINDS) {
      const view = cellRegistry[kind];
      expect(typeof view.component).toBe("function");
      expect(view.icon).toBeTruthy();
      expect(view.tagLabelKey).toMatch(/^cell\./);
      expect(view.addLabelKey).toMatch(/^addbar\./);
      expect(view.typeClass).toMatch(/^type/);
      expect(view.hue.base).toMatch(/^--s-/);
      expect(view.hue.tint).toMatch(/^--s-/);
      expect(view.hue.strong).toMatch(/^--s-/);
    }
  });

  it("ADD_BAR_ORDER lists exactly the Kinds once each (a reordering of KINDS)", () => {
    expect([...ADD_BAR_ORDER].sort()).toEqual([...KINDS].sort());
  });
});
