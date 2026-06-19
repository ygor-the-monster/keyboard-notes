// Composes the maskable PWA icon from the two source layers:
//   public/icons/icon-fg.png  — the notebook + clef + keys artwork (transparent)
//   public/icons/icon-bg.png  — the full-bleed cream ruled-paper background
//
// Maskable icons are cropped by the OS into arbitrary shapes (circle, squircle,
// rounded square). So the background must bleed edge-to-edge and the foreground
// must sit inside the central ~80% "safe zone". We compose at 1024 (the native
// resolution of the source layers) and emit two sizes: the full 1024 for the
// large, high-DPI launcher slots tablets use, plus a 512 fallback. The earlier
// build downscaled the only output to 512, which left tablet home-screen icons
// blurry. Re-run with `npm run icons:maskable` if either layer changes.
import sharp from "sharp";

const CANVAS = 1024; // native source resolution — compose and emit at this size
const FG_HEIGHT = 680; // ~66% of canvas — keeps the artwork (incl. corners) inside the round-mask safe circle
const SIZES = [1024, 512]; // manifest references both (icons/maskable-icon-<size>x<size>.png)

const bg = await sharp("public/icons/icon-bg.png")
  .resize(CANVAS, CANVAS, { fit: "cover" })
  .toBuffer();

// Trim the foreground to its real content so scaling is relative to the artwork,
// not the transparent padding baked into the source PNG.
const { data: fgTrimmed } = await sharp("public/icons/icon-fg.png")
  .trim({ threshold: 1 })
  .toBuffer({ resolveWithObject: true });
const fg = await sharp(fgTrimmed).resize({ height: FG_HEIGHT }).toBuffer();

// Compose once at full canvas (sharp applies resize before composite, so any
// downscale must be a separate pass or the foreground would overflow the base).
const composed = await sharp(bg)
  .composite([{ input: fg, gravity: "center" }])
  .png()
  .toBuffer();

for (const size of SIZES) {
  const out = `public/icons/maskable-icon-${size}x${size}.png`;
  // size === CANVAS writes the composed pixels straight through (no resampling).
  await sharp(composed).resize(size, size).png().toFile(out);
  console.log(`Wrote ${out} (${size}x${size}).`);
}
