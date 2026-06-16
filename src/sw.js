/* Custom service worker (injectManifest mode). Replicates the previous generateSW behaviour
   — precache + offline SPA fallback + Google-Fonts runtime cache — and adds a Web Share Target
   so Android can share a .pnotes lesson file straight into the installed app. */
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

self.skipWaiting();
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (single page → always serve the precached index.html).
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Google Fonts — cache-first, long expiry.
registerRoute(
  /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts",
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
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
