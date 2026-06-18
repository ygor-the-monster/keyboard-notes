// Image loading / downscaling helpers for the image editor.
import type { Crop, ImageFilter } from "../../cells/kinds.ts";

const MAX_DIM = 1600;
const QUALITY = 0.85;

export { fileToDataUrl } from "../../utils/file.ts";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Scale down to MAX_DIM and re-encode (keeps storage small).
export async function normalizeImage(src: string): Promise<string> {
  const img = await loadImage(src);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return c.toDataURL("image/jpeg", QUALITY);
}

// ---- Non-destructive edit pipeline -----------------------------------------------
// Filter is applied at render time to the preserved original; nothing is ever baked in.
// Order: flip → rotate(90·k) → crop → colour filters.

const STEP = { bright: 0.07, contrast: 0.08, sat: 0.12 };

export function filterString(filter: ImageFilter): string {
  const b = 1 + STEP.bright * (filter.bright || 0);
  const c = 1 + STEP.contrast * (filter.contrast || 0);
  const s = 1 + STEP.sat * (filter.sat || 0);
  return `brightness(${b}) contrast(${c}) saturate(${s})`;
}

// Render the original image, with filter applied, into `canvas`. Returns the output dimensions.
// The annotation overlay sits on top in display space.
export function renderFiltered(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  filter: ImageFilter,
): { width: number; height: number } {
  const k = ((((filter.rotate || 0) % 360) + 360) / 90) % 4; // 0..3 quarter-turns CW
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const swap = k === 1 || k === 3;
  const ow = swap ? nh : nw; // oriented (flipped+rotated) size
  const oh = swap ? nw : nh;

  // 1) Draw the oriented image into a temp canvas.
  const oriented = document.createElement("canvas");
  oriented.width = ow;
  oriented.height = oh;
  const octx = oriented.getContext("2d")!;
  octx.save();
  octx.translate(ow / 2, oh / 2);
  octx.rotate((k * Math.PI) / 2);
  octx.scale(filter.flipH ? -1 : 1, filter.flipV ? -1 : 1);
  octx.drawImage(img, -nw / 2, -nh / 2, nw, nh);
  octx.restore();

  // 2) Crop (normalised over the oriented image) + colour filters → output canvas.
  const crop = filter.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(crop.x * ow);
  const sy = Math.round(crop.y * oh);
  const sw = Math.max(1, Math.round(crop.w * ow));
  const sh = Math.max(1, Math.round(crop.h * oh));
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, sw, sh);
  ctx.filter = filterString(filter);
  ctx.drawImage(oriented, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.filter = "none";
  return { width: sw, height: sh };
}

// Compose a freshly-drawn crop rect (normalised over the CURRENT display) into the existing crop,
// expressed in oriented-image coordinates — so crops nest correctly and stay reversible.
export function composeCrop(existing: Crop | null, r: Crop): Crop {
  const e = existing || { x: 0, y: 0, w: 1, h: 1 };
  return { x: e.x + r.x * e.w, y: e.y + r.y * e.h, w: r.w * e.w, h: r.h * e.h };
}

// Re-express a crop rect after a ±90° rotation / mirror so it stays glued to the image.
export function rotateCrop(crop: Crop | null, dir: number): Crop | null {
  if (!crop) return null;
  const { x, y, w, h } = crop;
  return dir > 0 ? { x: 1 - y - h, y: x, w: h, h: w } : { x: y, y: 1 - x - w, w: h, h: w };
}
export function flipCrop(crop: Crop | null, horizontal: boolean): Crop | null {
  if (!crop) return null;
  const { x, y, w, h } = crop;
  return horizontal ? { x: 1 - x - w, y, w, h } : { x, y: 1 - y - h, w, h };
}
