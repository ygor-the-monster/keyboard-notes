// Helpers for the External cell: recognise known providers, build their (deterministic) embed URL,
// and fetch a nice title once via oEmbed. React/DOM-free so it's unit-testable.
//
// The embed URLs are derived purely from the link, so no network call is needed to RENDER online.
// oEmbed is used only to auto-fill a readable title on add (online); offline always falls back to
// the placeholder card, so nothing here is required for the offline path.

export interface EmbedSpec {
  src: string;
  aspect?: string; // CSS aspect-ratio for video/doc frames, e.g. "16 / 9"
  height?: number; // fixed pixel height for audio widgets (no natural aspect)
}

export type ProviderId =
  | "youtube"
  | "vimeo"
  | "spotify"
  | "deezer"
  | "soundcloud"
  | "googledrive"
  | "googlemaps"
  | "slideshare";

export interface Provider {
  id: ProviderId;
  label: string;
  category: "video" | "audio" | "doc" | "map" | "presentation";
  embed: () => EmbedSpec | null; // null → can't embed deterministically; render a link card
  oembed?: () => string; // CORS-friendly oEmbed endpoint for title/thumbnail
}

const YT = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;
const SPOTIFY =
  /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/(\w+)/;
const DEEZER = /deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist)\/(\d+)/;
const DRIVE = /(?:\/file\/d\/|[?&]id=)([\w-]{10,})/;

const json = (endpoint: string, raw: string) =>
  `${endpoint}?format=json&url=${encodeURIComponent(raw)}`;

// Pull an embeddable query out of a Google Maps URL: explicit coords (@lat,lng), a `q=` param, or a
// /place/Name segment. Short links (maps.app.goo.gl) can't be expanded client-side → null.
function mapsQuery(raw: string, u: URL): string | null {
  const at = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return `${at[1]},${at[2]}`;
  const q = u.searchParams.get("q");
  if (q) return q;
  const place = raw.match(/\/place\/([^/@]+)/);
  if (place) return decodeURIComponent(place[1].replace(/\+/g, " "));
  return null;
}

// Identify the provider for a URL (or null for a generic page). Each provider's `embed` closure
// captures the parsed ids, so callers don't re-parse.
export function detectProvider(raw: string): Provider | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  const yt = raw.match(YT);
  if (yt)
    return {
      id: "youtube",
      label: "YouTube",
      category: "video",
      embed: () => ({ src: `https://www.youtube.com/embed/${yt[1]}`, aspect: "16 / 9" }),
      oembed: () => json("https://www.youtube.com/oembed", raw),
    };

  const vimeo = raw.match(VIMEO);
  if (vimeo)
    return {
      id: "vimeo",
      label: "Vimeo",
      category: "video",
      embed: () => ({ src: `https://player.vimeo.com/video/${vimeo[1]}`, aspect: "16 / 9" }),
      oembed: () => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(raw)}`,
    };

  if (host === "open.spotify.com") {
    const m = raw.match(SPOTIFY);
    if (m)
      return {
        id: "spotify",
        label: "Spotify",
        category: "audio",
        embed: () => ({
          src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
          height: m[1] === "track" || m[1] === "episode" ? 152 : 352,
        }),
        oembed: () => `https://open.spotify.com/oembed?url=${encodeURIComponent(raw)}`,
      };
  }

  if (host.endsWith("deezer.com")) {
    const m = raw.match(DEEZER);
    if (m)
      return {
        id: "deezer",
        label: "Deezer",
        category: "audio",
        embed: () => ({
          src: `https://widget.deezer.com/widget/auto/${m[1]}/${m[2]}`,
          height: m[1] === "track" ? 92 : 300,
        }),
      };
  }

  if (host === "soundcloud.com")
    return {
      id: "soundcloud",
      label: "SoundCloud",
      category: "audio",
      embed: () => ({
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&color=%23ff5500&show_comments=false`,
        height: 166,
      }),
      oembed: () => json("https://soundcloud.com/oembed", raw),
    };

  if (host === "drive.google.com") {
    const m = raw.match(DRIVE);
    if (m)
      return {
        id: "googledrive",
        label: "Google Drive",
        category: "doc",
        embed: () => ({ src: `https://drive.google.com/file/d/${m[1]}/preview`, aspect: "16 / 9" }),
      };
  }

  if (host === "maps.google.com" || (host === "google.com" && u.pathname.startsWith("/maps"))) {
    const q = mapsQuery(raw, u);
    return {
      id: "googlemaps",
      label: "Google Maps",
      category: "map",
      embed: () =>
        q
          ? {
              src: `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`,
              aspect: "4 / 3",
            }
          : null,
    };
  }

  if (host.endsWith("slideshare.net"))
    return {
      id: "slideshare",
      label: "SlideShare",
      category: "presentation",
      embed: () => null, // the embed code needs a key only available via a server call → link card
      oembed: () =>
        `https://www.slideshare.net/api/oembed/2?url=${encodeURIComponent(raw)}&format=json`,
    };

  return null;
}

// The deterministic embed spec for a URL, or null (generic page / un-embeddable provider).
export function embedFor(raw: string): EmbedSpec | null {
  return detectProvider(raw)?.embed() ?? null;
}

// Fetch a readable title (and thumbnail) once via the provider's oEmbed endpoint. Online-only and
// fail-soft: any error (offline, CORS, non-provider) resolves to null and the caller keeps the
// hostname-derived title.
export async function fetchMeta(
  raw: string,
): Promise<{ title?: string; thumbnail?: string } | null> {
  const endpoint = detectProvider(raw)?.oembed?.();
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const j: unknown = await res.json();
    const o = j as { title?: unknown; thumbnail_url?: unknown };
    return {
      title: typeof o.title === "string" ? o.title : undefined,
      thumbnail: typeof o.thumbnail_url === "string" ? o.thumbnail_url : undefined,
    };
  } catch {
    return null;
  }
}

// A human-ish label from the URL's host (e.g. "https://www.youtube.com/…" -> "youtube.com"),
// used as the link-card / offline title until oEmbed or the maker supplies a real one.
export function deriveTitle(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
