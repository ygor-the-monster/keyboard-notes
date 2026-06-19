import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { IconContext } from "@phosphor-icons/react";
import { usePref } from "../StoreProvider/StoreProvider.utils.ts";
import "./ThemeProvider.globals.css";

// App theme: thin Phosphor icons + the global design-token layer. The colour scheme (light/dark)
// persists in localStorage and drives the manuscript token layer via [data-color-scheme] on <html>.
export interface ThemeValue {
  scheme: string;
  setScheme: (next: string | ((prev: string) => string)) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setScheme] = usePref("theme", "light");

  useEffect(() => {
    document.documentElement.dataset.colorScheme = scheme;
    // Keep the browser/PWA toolbar (theme-color) in sync with the user's chosen scheme —
    // values mirror --canvas in ThemeProvider.globals.css.
    const themeColor = scheme === "dark" ? "#181715" : "#f6f5f1";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
  }, [scheme]);

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      setScheme,
      toggle: () => setScheme((s) => (s === "dark" ? "light" : "dark")),
    }),
    [scheme, setScheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <IconContext.Provider value={{ weight: "light", size: 20 }}>{children}</IconContext.Provider>
    </ThemeContext.Provider>
  );
}
