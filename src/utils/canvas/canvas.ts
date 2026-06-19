// Canvas backing-store helpers. Drawing to a canvas at device resolution means sizing its backing
// store to the CSS box × devicePixelRatio and transforming the context back to CSS pixels — the
// fiddly, easy-to-get-wrong dance the AnnotationLayer, the AudioCell waveform, and the PDF page
// render all need.

// The device pixel ratio, capped at 2 (beyond that the extra backing-store cost isn't worth it).
export const displayScale = (): number => Math.min(window.devicePixelRatio || 1, 2);

// Size `cv`'s backing store to a CSS box of `cssW`×`cssH` at device resolution, then return a 2D
// context already transformed to CSS-pixel coordinates and cleared. Draw in CSS pixels afterwards.
export function setupCanvas(
  cv: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D {
  const dpr = displayScale();
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  const ctx = cv.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}
