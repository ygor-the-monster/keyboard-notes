// A pointer's position within an element, normalised to [0,1] on each axis and clamped to the box.
// Shared by the freehand annotation layer, the image crop overlay, and the audio waveform scrub —
// each turns a raw clientX/Y into a fraction of its element, the same getBoundingClientRect dance.
import { clamp } from "../numeric/numeric.ts";

export function normalizePointer(
  e: { clientX: number; clientY: number },
  el: Element,
): [number, number] {
  const r = el.getBoundingClientRect();
  return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)];
}
