import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-oxc";
import macros from "unplugin-parcel-macros";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import { VitePWA } from "vite-plugin-pwa";

// Relative base so the build works at any GitHub Pages path.
export default defineConfig({
  base: "./",
  plugins: [
    macros.vite(), // Must be first — compiles the S2 `style` macro.
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
      // Raster app icons are generated from the detailed PNG (best at larger sizes);
      // icon-simple.svg is the crisp scalable favicon + in-app logo (wired in index.html /
      // Topbar).
      pwaAssets: { preset: "minimal-2023", image: "public/icon-detailed.png" },
      manifest: {
        name: "Piano Notes",
        short_name: "Piano Notes",
        description: "A notebook for piano lessons — Markdown + music notation with playback.",
        theme_color: "#070c0b",
        background_color: "#070c0b",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        scope: "./",
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: ["es2022"],
    cssMinify: "lightningcss",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/macro-(.*)\.css$/.test(id) || /@react-spectrum\/s2\/.*\.css$/.test(id)) {
            return "s2-styles";
          }
        },
      },
    },
  },
});
