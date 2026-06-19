import { useEffect, type RefObject } from "react";

// Wire an <audio> element into the OS media controls — lock screen, headphone/Bluetooth buttons, the
// now-playing widget — via the Media Session API. The session is a single global one, so only the
// element that's currently playing should own it: the caller passes `active` (its own `playing`
// state) and the last cell to start playing wins. No-ops where the API is missing.
export function useMediaSession({
  audioRef,
  active,
  title,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  active: boolean;
  title: string;
}): void {
  useEffect(() => {
    const a = audioRef.current;
    if (!("mediaSession" in navigator) || !a || !active) return;
    const ms = navigator.mediaSession;

    ms.metadata = new MediaMetadata({
      title,
      artist: "Keyboard Notes",
      // BASE_URL-prefixed so it resolves under the GitHub Pages subpath (a bare
      // "/pwa-192x192.png" would 404 there). The raster is generated to the dist root.
      artwork: [
        { src: `${import.meta.env.BASE_URL}pwa-192x192.png`, sizes: "192x192", type: "image/png" },
      ],
    });
    ms.playbackState = "playing";

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void a.play()],
      ["pause", () => a.pause()],
      ["seekbackward", (d) => (a.currentTime = Math.max(0, a.currentTime - (d.seekOffset ?? 10)))],
      [
        "seekforward",
        (d) => (a.currentTime = Math.min(a.duration, a.currentTime + (d.seekOffset ?? 10))),
      ],
      [
        "seekto",
        (d) => {
          if (d.seekTime != null) a.currentTime = d.seekTime;
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Some actions aren't supported on every platform — ignore the ones that throw.
      }
    }

    return () => {
      ms.playbackState = "paused";
      for (const [action] of handlers) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // ignore — see above
        }
      }
    };
  }, [audioRef, active, title]);
}
