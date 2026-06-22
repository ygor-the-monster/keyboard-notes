/* Custom service worker (injectManifest mode). Provides precache + offline SPA fallback,
   and a Web Share Target so Android can share a .pnotes lesson file straight into the
   installed app. Fonts are self-hosted under /fonts and precached via __WB_MANIFEST
   (the woff2 glob in vite.config.js), so no Google-Fonts runtime cache is needed. */
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (single page → always serve the precached index.html).
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// The music-tutor KB retrieval index is deliberately NOT precached (it's part of the opt-in,
// WebGPU-only tutor — like the Transformers.js chunk, never paid for by users who don't open it).
// But once the tutor has fetched it, it should keep working offline, so cache it
// stale-while-revalidate: instant from cache, refreshed in the background when online.
registerRoute(
  ({ url }) => url.pathname.endsWith("/kb-index.json"),
  new StaleWhileRevalidate({ cacheName: "kb-index" }),
);

// Web Share Target: a shared file POSTs here. Stash it, then redirect into the app, which
// reads it on load (see App.jsx). Handled before the navigation route via a direct listener.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("file");
          if (file) {
            const cache = await caches.open("shared-inbox");
            await cache.put("lesson", new Response(file));
          }
        } catch {
          // fall through to the redirect; the app shows nothing to import
        }
        return Response.redirect("./?share-target", 303);
      })(),
    );
  }
});
