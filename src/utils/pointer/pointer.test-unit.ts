import { describe, it, expect } from "vitest";
import { normalizePointer } from "./pointer.ts";

// A stub element whose box is 200×100 at offset (50, 20).
const stub = {
  getBoundingClientRect: () => ({ left: 50, top: 20, width: 200, height: 100 }),
} as unknown as Element;

describe("normalizePointer", () => {
  it("maps a point to its fraction of the element box", () => {
    expect(normalizePointer({ clientX: 150, clientY: 70 }, stub)).toEqual([0.5, 0.5]);
    expect(normalizePointer({ clientX: 50, clientY: 20 }, stub)).toEqual([0, 0]);
    expect(normalizePointer({ clientX: 250, clientY: 120 }, stub)).toEqual([1, 1]);
  });

  it("clamps points outside the box to [0,1]", () => {
    expect(normalizePointer({ clientX: 0, clientY: 0 }, stub)).toEqual([0, 0]);
    expect(normalizePointer({ clientX: 9999, clientY: 9999 }, stub)).toEqual([1, 1]);
  });
});
