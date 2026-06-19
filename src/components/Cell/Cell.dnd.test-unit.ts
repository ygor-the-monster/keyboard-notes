import { describe, it, expect } from "vitest";
import { dropIndex, type CellRect } from "./Cell.dnd.ts";

// Four 100px cells stacked at 0,100,200,300 (no transform).
const settled = (): CellRect[] => [
  { top: 0, height: 100, ty: 0 },
  { top: 100, height: 100, ty: 0 },
  { top: 200, height: 100, ty: 0 },
  { top: 300, height: 100, ty: 0 },
];

describe("dropIndex", () => {
  it("targets the slot whose midpoint the pointer has crossed", () => {
    expect(dropIndex(settled(), 20)).toBe(0); // above the first midpoint (50)
    expect(dropIndex(settled(), 120)).toBe(1); // crossed midpoint 50, before 150
    expect(dropIndex(settled(), 360)).toBe(4); // past the last midpoint → end
  });

  it("jumps multiple slots in one move (down)", () => {
    expect(dropIndex(settled(), 320)).toBe(3); // straight to the bottom region, not one-at-a-time
  });

  // The regression: a neighbour mid-FLIP reports a transformed rect. Subtracting ty must recover the
  // settled midpoint so the result is identical to the not-animating case — otherwise downward drags
  // stall (the cell slid up reports a lower top → inflated midpoint → target won't advance).
  it("ignores an in-flight FLIP slide (down drag stays unblocked)", () => {
    const sliding: CellRect[] = [
      { top: 0, height: 100, ty: 0 },
      { top: 140, height: 100, ty: 40 }, // settling to 100, currently displaced +40 (sliding up)
      { top: 200, height: 100, ty: 0 },
      { top: 300, height: 100, ty: 0 },
    ];
    // Pointer at 320 must still resolve to 3, exactly as the settled layout does.
    expect(dropIndex(sliding, 320)).toBe(dropIndex(settled(), 320));
    expect(dropIndex(sliding, 320)).toBe(3);
  });

  it("is symmetric: same pointer Y gives the same target regardless of slide direction", () => {
    const slidingDown: CellRect[] = [
      { top: 0, height: 100, ty: 0 },
      { top: 70, height: 100, ty: -30 }, // settling to 100, displaced -30 (sliding down)
      { top: 200, height: 100, ty: 0 },
      { top: 300, height: 100, ty: 0 },
    ];
    expect(dropIndex(slidingDown, 120)).toBe(dropIndex(settled(), 120));
  });
});
