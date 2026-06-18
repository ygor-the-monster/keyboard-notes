import { describe, it, expect } from "vitest";
import {
  withAlpha,
  thicknessFraction,
  hitStrokeIndex,
  buildAnnotationTools,
  ANNOT_THICKNESS,
} from "./AnnotationLayer.utils.ts";
import type { AnnotationStroke } from "../../cells/kinds.ts";

describe("withAlpha", () => {
  it("applies alpha to rgb() and #hex (incl. shorthand)", () => {
    expect(withAlpha("rgb(10,20,30)", 0.5)).toBe("rgba(10,20,30,0.5)");
    expect(withAlpha("#ffffff", 0.3)).toBe("rgba(255,255,255,0.3)");
    expect(withAlpha("#fff", 1)).toBe("rgba(255,255,255,1)");
  });
});

describe("thicknessFraction", () => {
  it("maps a key to its fraction and defaults to medium", () => {
    expect(thicknessFraction("s")).toBe(ANNOT_THICKNESS[0].f);
    expect(thicknessFraction("nope")).toBe(ANNOT_THICKNESS[1].f);
  });
});

describe("hitStrokeIndex", () => {
  it("returns the topmost stroke within tolerance, else -1", () => {
    const strokes: AnnotationStroke[] = [
      { color: "#000", width: 0, opacity: 1, points: [[0.1, 0.1]] },
      { color: "#000", width: 0, opacity: 1, points: [[0.5, 0.5]] },
    ];
    expect(hitStrokeIndex(strokes, 0.5, 0.5, 0.02)).toBe(1);
    expect(hitStrokeIndex(strokes, 0.9, 0.9, 0.02)).toBe(-1);
  });
});

describe("buildAnnotationTools", () => {
  it("builds the pen/colour/thickness/opacity + undo/redo/clear tool strip", () => {
    const noop = () => {};
    const tools = buildAnnotationTools({
      t: (k) => k,
      color: "#000",
      setColor: noop,
      thick: "m",
      setThick: noop,
      opacity: 1,
      setOpacity: noop,
      eraser: false,
      setEraser: noop,
      onUndo: noop,
      onRedo: noop,
      onClear: noop,
      canUndo: false,
      canRedo: true,
      canClear: false,
    });
    expect(tools.map((x) => x.kind)).toEqual([
      "toggle",
      "group",
      "group",
      "group",
      "sep",
      "action",
      "action",
      "action",
    ]);
    const undo = tools.find((x) => "id" in x && x.id === "annUndo");
    const redo = tools.find((x) => "id" in x && x.id === "annRedo");
    expect(undo && "disabled" in undo && undo.disabled).toBe(true); // canUndo false
    expect(redo && "disabled" in redo && redo.disabled).toBe(false); // canRedo true
  });
});
