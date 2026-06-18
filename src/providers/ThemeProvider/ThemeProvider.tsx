import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { Provider } from "@react-spectrum/s2";
import "@react-spectrum/s2/page.css";
import { IconContext } from "@phosphor-icons/react";
import { usePref } from "../StoreProvider/StoreProvider.utils.ts";
import "./ThemeProvider.globals.css";

// App theme: Spectrum 2 + thin Phosphor icons + the global design-token layer. The colour scheme
// (light/dark) persists in localStorage and drives both S2 components (via the Provider) and the
// manuscript token layer (via [data-color-scheme] on <html>).
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
    <Provider background="base" colorScheme={scheme as "light" | "dark"}>
      <ThemeContext.Provider value={value}>
        <IconContext.Provider value={{ weight: "light", size: 20 }}>
          {children}
        </IconContext.Provider>
      </ThemeContext.Provider>
    </Provider>
  );
}
