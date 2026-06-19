import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LOCALES, MESSAGES, DEFAULT_LOCALE } from "./locales/index.ts";

// Tiny app-level i18n. useI18n() → { locale, setLocale, locales, t }.
//   t("audio.largeMsg", { mb: "5.2" })  → interpolates {mb} placeholders.
// Lookups walk the dotted key path in the active locale, then fall back to English, then to the
// raw key — so a missing translation degrades gracefully, never throws. Toolbar tools translate
// their own labels through t() at build time (see each cell's *.tools.ts builder).

export interface I18nValue {
  locale: string;
  setLocale: (l: string) => void;
  locales: readonly string[];
  t: (key: string, vars?: Record<string, unknown>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORE_KEY = "pianoNotes.locale";

// Locale dictionaries are plain data from a .js module; index them loosely by locale/key.
const messages = MESSAGES as Record<string, any>;

function detectLocale(): string {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && LOCALES.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  const langs = typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : [];
  for (const l of langs) {
    const base = String(l || "")
      .toLowerCase()
      .slice(0, 2);
    if (LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

function resolve(dict: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), dict);
}

function interpolate(str: string, vars?: Record<string, unknown>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<string>(detectLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, locale);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: string) => {
    if (LOCALES.includes(l)) setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, unknown>) => {
      const hit = resolve(messages[locale], key);
      const val = hit != null ? hit : resolve(messages[DEFAULT_LOCALE], key);
      return typeof val === "string" ? interpolate(val, vars) : key;
    },
    [locale],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, locales: LOCALES, t }),
    [locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
