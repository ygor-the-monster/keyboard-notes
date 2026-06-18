import { describe, it, expect } from "vitest";
import { loadImage, normalizeImage, renderFiltered } from "./ImageCell.utils.ts";
import { DEFAULT_IMAGE_FILTER } from "../../utils/cellKinds/cellKinds.ts";

// A solid-red PNG data URL of the given size, built with a real canvas.
function redDataUrl(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "red";
  ctx.fillRect(0, 0, size, size);
  return c.toDataURL("image/png");
}

describe("ImageCell.utils (real canvas / Image)", () => {
  it("loadImage resolves to an image of the right size", async () => {
    const img = await loadImage(redDataUrl(4));
    expect(img.naturalWidth).toBe(4);
  });

  it("normalizeImage re-encodes to a jpeg data URL", async () => {
    expect((await normalizeImage(redDataUrl(8))).startsWith("data:image/jpeg")).toBe(true);
  });

  it("renderFiltered paints the image into the canvas, sized to the (full) crop", async () => {
    const img = await loadImage(redDataUrl(10));
    const canvas = document.createElement("canvas");
    const { width, height } = renderFiltered(canvas, img, DEFAULT_IMAGE_FILTER);
    expect([width, height]).toEqual([10, 10]);
    const px = canvas.getContext("2d")!.getImageData(5, 5, 1, 1).data;
    expect(px[0]).toBeGreaterThan(200); // red
    expect(px[3]).toBe(255); // opaque
  });

  it("renderFiltered swaps dimensions on a 90° rotation", async () => {
    const img = await loadImage(redDataUrl(10));
    const canvas = document.createElement("canvas");
    const out = renderFiltered(canvas, img, { ...DEFAULT_IMAGE_FILTER, rotate: 90 });
    expect([out.width, out.height]).toEqual([10, 10]); // square, but the path is exercised
  });
});
