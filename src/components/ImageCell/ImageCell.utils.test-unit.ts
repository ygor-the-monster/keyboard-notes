import { describe, it, expect } from "vitest";
import { composeCrop, rotateCrop, flipCrop, filterString } from "./ImageCell.utils.ts";
import type { Crop } from "../../utils/cellKinds/cellKinds.ts";

const near = (a: Crop, b: Crop) => {
  expect(a.x).toBeCloseTo(b.x);
  expect(a.y).toBeCloseTo(b.y);
  expect(a.w).toBeCloseTo(b.w);
  expect(a.h).toBeCloseTo(b.h);
};

describe("composeCrop", () => {
  it("nests a new crop inside an existing one", () => {
    const e = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    expect(composeCrop(e, { x: 0.5, y: 0, w: 0.5, h: 1 })).toEqual({
      x: 0.1 + 0.5 * 0.8,
      y: 0.1,
      w: 0.5 * 0.8,
      h: 0.8,
    });
  });
  it("treats a null existing crop as the full frame", () => {
    const r = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };
    expect(composeCrop(null, r)).toEqual(r);
  });
});

describe("rotateCrop", () => {
  it("returns null for null", () => {
    expect(rotateCrop(null, 1)).toBeNull();
  });
  it("CW then CCW restores the original", () => {
    const c = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    near(rotateCrop(rotateCrop(c, 1)!, -1)!, c);
  });
});

describe("flipCrop", () => {
  it("is its own inverse, both axes", () => {
    const c = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    near(flipCrop(flipCrop(c, true)!, true)!, c);
    near(flipCrop(flipCrop(c, false)!, false)!, c);
  });
});

describe("filterString", () => {
  it("is identity at zero and scales each channel", () => {
    const base = { rotate: 0, flipH: false, flipV: false, crop: null };
    expect(filterString({ ...base, bright: 0, contrast: 0, sat: 0 })).toBe(
      "brightness(1) contrast(1) saturate(1)",
    );
    expect(filterString({ ...base, bright: 1, contrast: 0, sat: 0 })).toContain("brightness(1.07)");
  });
});
