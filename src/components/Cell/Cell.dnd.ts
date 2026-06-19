// Pure drop-target maths for cell drag-to-reorder, kept out of the component so it can be unit
// tested. Given the OTHER cells' rects (top + height) and the live translateY each currently has
// from an in-flight FLIP slide, pick the index the pointer (viewport Y) is over.
//
// Subtracting `ty` is load-bearing: while a neighbour slides it reports a transformed rect, and
// using that moving position makes a downward drag stall one slot at a time (the slide inflates the
// midpoint). Comparing against the SETTLED midpoint keeps reordering symmetric up and down.

export interface CellRect {
  top: number; // getBoundingClientRect().top (includes any current transform)
  height: number;
  ty: number; // current translateY from CSS transform, to be removed
}

export function dropIndex(rects: CellRect[], clientY: number): number {
  for (let k = 0; k < rects.length; k++) {
    const settledMid = rects[k].top - rects[k].ty + rects[k].height / 2;
    if (clientY < settledMid) return k;
  }
  return rects.length;
}
