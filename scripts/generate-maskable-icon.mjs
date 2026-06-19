// Composes the maskable PWA icon from the two source layers:
//   public/icons/icon-fg.png  — the notebook + clef + keys artwork (transparent)
//   public/icons/icon-bg.png  — the full-bleed cream ruled-paper background
//
// Maskable icons are cropped by the OS into arbitrary shapes (circle, squircle,
// rounded square). So the background must bleed edge-to-edge and the foreground
// must sit inside the central ~80% "safe zone". We scale the foreground down to
// FG_HEIGHT within a 1024 canvas, then downscale the result to the 512 the
// manifest references. Re-run with `npm run icons:maskable` if either layer changes.
import sharp from "sharp";

const CANVAS = 1024; // compose large, then downscale for crispness
const OUT = 512; // size referenced by the manifest (maskable-icon-512x512.png)
const FG_HEIGHT = 680; // ~66% of canvas — keeps the artwork (incl. corners) inside the round-mask safe circle

const bg = await sharp("public/icons/icon-bg.png")
  .resize(CANVAS, CANVAS, { fit: "cover" })
  .toBuffer();

// Trim the foreground to its real content so scaling is relative to the artwork,
// not the transparent padding baked into the source PNG.
const { data: fgTrimmed } = await sharp("public/icons/icon-fg.png")
  .trim({ threshold: 1 })
  .toBuffer({ resolveWithObject: true });
const fg = await sharp(fgTrimmed).resize({ height: FG_HEIGHT }).toBuffer();

// Compose at full canvas first (sharp applies resize before composite, so the
// downscale must be a separate pass or the foreground would overflow the base).
const composed = await sharp(bg)
  .composite([{ input: fg, gravity: "center" }])
  .png()
  .toBuffer();

await sharp(composed).resize(OUT, OUT).png().toFile("public/icons/maskable-icon-512x512.png");

console.log(`Wrote public/icons/maskable-icon-512x512.png (${OUT}x${OUT}).`);
