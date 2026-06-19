import { useEffect } from "react";

// Screen Wake Lock — keep the display awake while the user reads a lesson at the piano (hands on the
// keys, no taps to keep the screen alive). The lock is auto-released by the browser whenever the tab
// is hidden, so we re-acquire on `visibilitychange`; nothing keeps the screen on once the app is
// backgrounded, so it never drains battery while unused. No-ops where the API is missing (Safari).
interface WakeLockSentinel {
  released: boolean;
  release(): Promise<void>;
}
interface WakeLockApi {
  request(type: "screen"): Promise<WakeLockSentinel>;
}

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await api.request("screen");
      } catch {
        // request() rejects when the page isn't visible or the OS denies it (e.g. low battery) —
        // harmless; the visibilitychange listener retries next time the app is shown.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
