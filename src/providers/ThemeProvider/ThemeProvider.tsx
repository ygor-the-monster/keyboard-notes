import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { IconContext } from "@phosphor-icons/react";
import { usePref } from "../StoreProvider/StoreProvider.utils.ts";
import "./ThemeProvider.globals.css";

// Discrete app-zoom levels. Installed (standalone) the app fills a taller viewport with no browser
// chrome, so the fixed-px layout reads larger — this lets the user scale the whole app like a
// browser's own zoom (we drive CSS `zoom` on <html> so layout, fonts and fixed overlays all scale
// together). Keep 1 (100%) in the list so "reset" lands on a real level.
export const ZOOM_LEVELS = [0.75, 0.9, 1, 1.1, 1.25, 1.5] as const;

// App theme: thin Phosphor icons + the global design-token layer. The colour scheme (light/dark)
// persists in localStorage and drives the manuscript token layer via [data-color-scheme] on <html>.
export interface ThemeValue {
  scheme: string;
  setScheme: (next: string | ((prev: string) => string)) => void;
  toggle: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = usePref("theme", "light");
  const [zoom, setZoom] = usePref<number>("zoom", 1);

  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
    // Keep the browser/PWA toolbar (theme-color) in sync with the user's chosen scheme —
    // values mirror --canvas in ThemeProvider.globals.css.
    const themeColor = scheme === "dark" ? "#181715" : "#f6f5f1";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [scheme]);

  // CSS `zoom` on the root scales the whole app uniformly (Chromium + Safari + Firefox ≥126).
  // The dock measures `--topbar-h` and uses `dvh` inside this same scaled space, so they stay
  // consistent. Print resets to 1 via @media print in the globals.
  useEffect(() => {
    document.documentElement.style.zoom = String(zoom);
  }, [zoom]);

  // Step to the neighbouring preset, snapping from whatever the current value is.
  const stepZoom = useCallback(
    (dir: number) =>
      setZoom((z) => {
        let idx = 0;
        let best = Infinity;
        ZOOM_LEVELS.forEach((lvl, i) => {
          const d = Math.abs(lvl - z);
          if (d < best) {
            best = d;
            idx = i;
          }
        });
        return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, Math.max(0, idx + dir))];
      }),
    [setZoom],
  );

  // Browser-style zoom shortcuts — so Cmd/Ctrl +/-/0 drive the app zoom in standalone too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        stepZoom(1);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        stepZoom(-1);
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepZoom, setZoom]);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      setScheme,
      toggle: () => setScheme((s) => (s === "dark" ? "light" : "dark")),
      zoom,
      setZoom,
      zoomIn: () => stepZoom(1),
      zoomOut: () => stepZoom(-1),
      resetZoom: () => setZoom(1),
    }),
    [scheme, setScheme, zoom, setZoom, stepZoom],
  );

  return (
    <ThemeContext.Provider value={value}>
      <IconContext.Provider value={{ weight: "light", size: 20 }}>{children}</IconContext.Provider>
    </ThemeContext.Provider>
  );
}
