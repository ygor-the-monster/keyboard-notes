import { describe, it, expect } from "vitest";
import { clamp } from "./numeric.ts";

describe("clamp", () => {
  it("returns the value when inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("pins to the bounds when outside", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it("handles negative ranges", () => {
    expect(clamp(-20, -11, 11)).toBe(-11);
    expect(clamp(20, -11, 11)).toBe(11);
  });
});
