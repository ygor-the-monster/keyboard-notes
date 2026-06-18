import { describe, it, expect } from "vitest";
import { drawStrokes } from "./AnnotationLayer.utils.ts";
import type { AnnotationStroke } from "../../utils/cellKinds/cellKinds.ts";

describe("AnnotationLayer drawing (real canvas)", () => {
  it("drawStrokes paints a stroke onto the canvas", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    const strokes: AnnotationStroke[] = [
      {
        color: "rgb(255,0,0)",
        width: 0.05,
        opacity: 1,
        points: [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      },
    ];
    drawStrokes(ctx, strokes, 100, 100);
    // The horizontal stroke runs across the middle, so the centre pixel is painted.
    expect(ctx.getImageData(50, 50, 1, 1).data[3]).toBeGreaterThan(0);
    // A corner well away from the stroke stays blank.
    expect(ctx.getImageData(2, 2, 1, 1).data[3]).toBe(0);
  });
});
