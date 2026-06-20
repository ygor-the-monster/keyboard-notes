import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// Tiny client router. Screens are declared in the URL *hash* (`#metronome`); query params stay
// reserved for one-off launch actions (`?new=1`, `?tool=…`). Hash routing is deliberate: it never
// reaches the server, so deep links work under GitHub Pages with no SPA fallback, and the
// file-handler / share-target paths are untouched. Navigation goes through the History API so the
// browser's back/forward buttons drive screen open/close.
export interface RouteValue {
  /** Active screen id (the hash without `#`), or null when on the lesson. */
  screen: string | null;
  openScreen: (id: string) => void;
  closeScreen: () => void;
}

const RouteContext = createContext<RouteValue | null>(null);

export function useRoute(): RouteValue {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error("useRoute must be used within RouteProvider");
  return ctx;
}

function screenFromHash(): string | null {
  const h = window.location.hash.replace(/^#/, "").trim();
  return h || null;
}

export function RouteProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<string | null>(() => screenFromHash());

  // Back/forward (popstate) and any manual hash edit (hashchange) re-derive the screen from the URL.
  useEffect(() => {
    const sync = () => setScreen(screenFromHash());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const openScreen = useCallback((id: string) => {
    if (screenFromHash() === id) return;
    // Tag the entry so closeScreen knows a back() will land on the lesson (vs a direct deep-link).
    window.history.pushState({ appScreen: id }, "", "#" + id);
    setScreen(id);
  }, []);

  const closeScreen = useCallback(() => {
    if (window.history.state?.appScreen) {
      // We pushed this entry — step back so forward still works and history stays clean.
      window.history.back();
    } else {
      // Direct deep-link (no prior lesson entry): drop the hash in place instead of leaving the app.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      setScreen(null);
    }
  }, []);

  return (
    <RouteContext.Provider value={{ screen, openScreen, closeScreen }}>
      {children}
    </RouteContext.Provider>
  );
}
