import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-oxc";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import { VitePWA } from "vite-plugin-pwa";

// Relative base so the build works at any GitHub Pages path.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      ...optimizeLocales.vite({ locales: ["en-US"] }),
      enforce: "pre",
    },
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      // Raster app icons are generated from the detailed PNG (best at larger sizes;
      // see pwa-assets.config.ts); icon-simple.svg is the crisp scalable favicon +
      // in-app logo (wired in index.html / Topbar). The maskable icon is composed
      // separately (full-bleed background + safe-zone foreground) and listed in the
      // manifest below — `overrideManifestIcons: false` keeps the plugin from
      // clobbering that hand-authored `icons` list.
      pwaAssets: { config: true, overrideManifestIcons: false },
      manifest: {
        icons: [
          // pwa-*.png are generated into the dist root by @vite-pwa/assets-generator
          // (its head-link preset assumes root), so these stay unprefixed. The
          // hand-authored/committed icons live in public/icons/ → "icons/" prefix.
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Two maskable sizes: tablets render the home-screen icon physically
          // large at high DPI and pick the biggest maskable available, so the
          // full-res 1024 keeps it crisp; the 512 is the fallback.
          {
            src: "icons/maskable-icon-1024x1024.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          // Solid-black SVG; the OS re-tints it for themed/monochrome contexts
          // (e.g. Android notification badge, monochrome launcher themes).
          {
            src: "icons/icon-mono.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "monochrome",
          },
        ],
        // Stable install identity, decoupled from start_url/scope — so changing the
        // GitHub Pages path later doesn't make the OS treat this as a brand-new app.
        id: "./",
        name: "Keyboard Notes",
        short_name: "Keyboard Notes",
        description: "A practice notebook for people learning an instrument — notes, engraved staves you can hear, chord charts, recordings, and sheet-music PDFs in one lesson.",
        categories: ["music", "education", "productivity"],
        // Shown in Android/Chromium's rich install dialog. Needs both a wide
        // (desktop) and narrow (mobile) form factor to trigger the richer UI;
        // captured from a real lesson via scripts/playwright, not mockups.
        screenshots: [
          {
            src: "screenshots/lesson-wide.png",
            sizes: "1440x900",
            type: "image/png",
            form_factor: "wide",
            label: "A lesson mixing notes, an engraved playable staff, and a chord chart",
          },
          {
            src: "screenshots/lesson-narrow.png",
            sizes: "412x915",
            type: "image/png",
            form_factor: "narrow",
            label: "The same lesson on a phone",
          },
          // Per-tool full-screen views. Added as each utility tool gains its expanded screen
          // (metronome first); they ride the same install carousel as the lesson shots.
          {
            src: "screenshots/tool-metronome-wide.png",
            sizes: "1440x900",
            type: "image/png",
            form_factor: "wide",
            label: "The metronome's full screen — accent pattern, subdivisions and polyrhythm",
          },
          {
            src: "screenshots/tool-metronome-narrow.png",
            sizes: "412x915",
            type: "image/png",
            form_factor: "narrow",
            label: "The metronome's full screen on a phone",
          },
          {
            src: "screenshots/tool-tuner-wide.png",
            sizes: "1440x900",
            type: "image/png",
            form_factor: "wide",
            label: "The tuner's full screen — instrument targets, stability trace and signal meter",
          },
          {
            src: "screenshots/tool-tuner-narrow.png",
            sizes: "412x915",
            type: "image/png",
            form_factor: "narrow",
            label: "The tuner's full screen on a phone",
          },
          {
            src: "screenshots/tool-scratchpad-wide.png",
            sizes: "1440x900",
            type: "image/png",
            form_factor: "wide",
            label: "The scratchpad's full screen — a roomy note area and a per-lesson to-do list",
          },
          {
            src: "screenshots/tool-scratchpad-narrow.png",
            sizes: "412x915",
            type: "image/png",
            form_factor: "narrow",
            label: "The scratchpad's full screen on a phone",
          },
        ],
        // Static fallback (manifests can't track color-scheme); the app boots light and
        // ThemeProvider updates the live <meta name="theme-color"> to follow the user's scheme.
        theme_color: "#f6f5f1",
        background_color: "#f6f5f1",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
        // Long-press / jump-list actions on the installed icon. Strings are baked at build time so
        // they can't be localized; "New lesson" arrives as ?new=1, handled in App. Each icon is a
        // Phosphor glyph on its tool's accent — generated by `npm run icons:shortcuts`.
        shortcuts: [
          {
            name: "New lesson",
            short_name: "New lesson",
            description: "Start a new blank lesson",
            url: "./?new=1",
            icons: [{ src: "icons/shortcut-new.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Metronome",
            short_name: "Metronome",
            description: "Open and start the metronome",
            url: "./?tool=metronome",
            icons: [{ src: "icons/shortcut-metronome.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Tuner",
            short_name: "Tuner",
            description: "Open and start the tuner",
            url: "./?tool=tuner",
            icons: [{ src: "icons/shortcut-tuner.png", sizes: "192x192", type: "image/png" }],
          },
        ],
        // Desktop/ChromeOS: open .pnotes files directly (File Handling API).
        file_handlers: [{ action: "./", accept: { "application/x-piano-notes": [".pnotes"] } }],
        // Android: share a .pnotes file into the installed app (Web Share Target API).
        share_target: {
          action: "./share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [
              {
                name: "file",
                accept: [
                  "application/x-piano-notes",
                  "application/json",
                  "application/octet-stream",
                  "text/plain",
                  ".pnotes",
                ],
              },
            ],
          },
        },
        launch_handler: { client_mode: "focus-existing" },
      },
      injectManifest: {
        // Include .mjs so the pdf.js worker (pdf.worker.min-*.mjs) is precached and PDFs
        // render offline. 4 MB cap covers the ~1.2 MB worker.
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,ico,woff2,otf}"],
        // icon-detailed/icon-fg/icon-bg are build-time SOURCE images (inputs to the icon
        // generators) that nothing references at runtime. The screenshots are only fetched
        // by the OS at install time, never offline. Both are still emitted to dist but
        // excluded from the precache, saving users ~900 KB on install.
        globIgnores: [
          "icon-detailed.png",
          "icons/icon-fg.png",
          "icons/icon-bg.png",
          "screenshots/*.png",
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ["es2022"],
    cssMinify: "lightningcss",
    sourcemap: false,
    // Heavy deps (abcjs, pdf-lib, pdfjs) are already lazy-loaded into their own
    // chunks; this raises the raw-size warning so it only flags real regressions.
    // If this trips again, split the main bundle / lazy-load the icon set.
    chunkSizeWarningLimit: 1024,
  },
});
