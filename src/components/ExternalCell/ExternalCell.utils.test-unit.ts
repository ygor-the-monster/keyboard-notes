import { describe, it, expect } from "vitest";
import { detectProvider, embedFor, deriveTitle } from "./ExternalCell.utils.ts";

describe("detectProvider", () => {
  it("recognises the known providers by URL", () => {
    expect(detectProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.id).toBe("youtube");
    expect(detectProvider("https://youtu.be/dQw4w9WgXcQ")?.id).toBe("youtube");
    expect(detectProvider("https://vimeo.com/76979871")?.id).toBe("vimeo");
    expect(detectProvider("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")?.id).toBe(
      "spotify",
    );
    expect(detectProvider("https://www.deezer.com/en/track/3135556")?.id).toBe("deezer");
    expect(detectProvider("https://soundcloud.com/artist/track")?.id).toBe("soundcloud");
    expect(detectProvider("https://drive.google.com/file/d/1AbCdEfGhIjK/view")?.id).toBe(
      "googledrive",
    );
    expect(detectProvider("https://www.google.com/maps/place/Paris/@48.85,2.35,12z")?.id).toBe(
      "googlemaps",
    );
    expect(detectProvider("https://www.slideshare.net/user/deck-123")?.id).toBe("slideshare");
  });

  it("returns null for a generic page", () => {
    expect(detectProvider("https://example.com/article")).toBeNull();
    expect(detectProvider("not a url")).toBeNull();
  });
});

describe("embedFor", () => {
  it("builds video embeds with a 16/9 aspect", () => {
    expect(embedFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "16 / 9",
    });
    expect(embedFor("https://vimeo.com/76979871")?.src).toBe(
      "https://player.vimeo.com/video/76979871",
    );
  });

  it("builds audio embeds with a fixed height", () => {
    const spotify = embedFor("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
    expect(spotify?.src).toBe("https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT");
    expect(spotify?.height).toBe(152);
    // Playlists are taller than single tracks.
    expect(embedFor("https://open.spotify.com/playlist/37i9dQ")?.height).toBe(352);
  });

  it("embeds a Google Maps link with coords, but not one without an extractable place", () => {
    expect(embedFor("https://www.google.com/maps/place/X/@48.85,2.35,12z")?.src).toContain(
      "q=48.85%2C2.35&output=embed",
    );
    expect(embedFor("https://maps.app.goo.gl/abc123")).toBeNull();
  });

  it("returns null for SlideShare (needs a server call) and generic pages", () => {
    expect(embedFor("https://www.slideshare.net/user/deck-123")).toBeNull();
    expect(embedFor("https://example.com/article")).toBeNull();
  });
});

describe("deriveTitle", () => {
  it("uses the host without a www. prefix", () => {
    expect(deriveTitle("https://www.youtube.com/watch?v=abc")).toBe("youtube.com");
  });

  it("falls back to the raw string for an unparseable URL", () => {
    expect(deriveTitle("not a url")).toBe("not a url");
  });
});
