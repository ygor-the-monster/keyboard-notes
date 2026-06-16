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
      includeAssets: ["icon.svg"],
      pwaAssets: { preset: "minimal-2023", image: "public/icon.svg" },
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
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "index.html",
        // The image editor + PDF.js chunks are large; allow precaching them for offline use.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
