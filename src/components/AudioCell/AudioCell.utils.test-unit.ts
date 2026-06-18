import { describe, it, expect } from "vitest";
import { fmtTime, remapMarksAfterTrim, remapMarksAfterCut } from "./AudioCell.utils.ts";
import type { Mark } from "../../utils/cellKinds/cellKinds.ts";

const pt = (id: string, time: number): Mark => ({ id, time, kind: "point" });

describe("fmtTime", () => {
  it("formats m:ss and clamps invalid input", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(65)).toBe("1:05");
    expect(fmtTime(-3)).toBe("0:00");
    expect(fmtTime(NaN)).toBe("0:00");
  });
});

describe("remapMarksAfterTrim", () => {
  it("keeps in-range points rebased to zero, drops the rest", () => {
    const out = remapMarksAfterTrim([pt("a", 1), pt("b", 5), pt("c", 12)], 2, 10);
    expect(out.map((m) => [m.id, m.time])).toEqual([["b", 3]]);
  });
});

describe("remapMarksAfterCut", () => {
  it("drops points inside the cut and pulls later ones back by its length", () => {
    const out = remapMarksAfterCut([pt("a", 1), pt("b", 5), pt("c", 12)], 2, 10); // span 8
    expect(out.map((m) => [m.id, m.time])).toEqual([
      ["a", 1],
      ["c", 4],
    ]);
  });
});
