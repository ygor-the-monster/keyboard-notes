import { defineConfig } from "@vite-pwa/assets-generator/config";

// Generates the raster app icons from the detailed PNG (plate + shadow — best at
// larger sizes). icon-detailed.png stays at the public root (not in icons/) on purpose:
// the generator emits pwa-*.png/favicon.ico/apple-touch next to its source image and
// injects head links at the root, which is where the manifest + code reference them.
// The `maskable` purpose is intentionally disabled here: it's
// composed separately from icons/icon-fg.png + icons/icon-bg.png (full-bleed, safe-zone) by
// scripts/generate-maskable-icon.mjs and listed manually in the manifest, since
// a maskable needs a different layout than the rounded "sticker" icon.
export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, "favicon.ico"]] },
    maskable: { sizes: [] },
    apple: { sizes: [180] },
  },
  images: ["public/icon-detailed.png"],
});
