import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOCALES, MESSAGES, DEFAULT_LOCALE } from "./locales/index.js";

// Tiny app-level i18n. useI18n() → { locale, setLocale, locales, t }.
//   t("audio.largeMsg", { mb: "5.2" })  → interpolates {mb} placeholders.
// Lookups walk the dotted key path in the active locale, then fall back to English,
// then to the raw key — so a missing translation degrades gracefully, never throws.
const I18nContext = createContext(null);
const STORE_KEY = "pianoNotes.locale";

function detectLocale() {
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

function resolve(dict, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, locale);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l) => LOCALES.includes(l) && setLocaleState(l), []);

  const t = useCallback(
    (key, vars) => {
      const hit = resolve(MESSAGES[locale], key);
      const val = hit != null ? hit : resolve(MESSAGES[DEFAULT_LOCALE], key);
      return typeof val === "string" ? interpolate(val, vars) : key;
    },
    [locale],
  );

  // Translate a toolbar label by its English text. Keys in the `toolLabels` map carry spaces
  // and punctuation, so they can't go through the dotted-path t(); this looks the label up
  // directly, falling back to English then to the label itself (graceful for un-mapped labels).
  const tl = useCallback(
    (label) => {
      const here = MESSAGES[locale]?.toolLabels;
      const en = MESSAGES[DEFAULT_LOCALE]?.toolLabels;
      return (here && here[label]) ?? (en && en[label]) ?? label;
    },
    [locale],
  );

  // Run a Toolbar `tools` array through tl(), translating every label / altLabel (including
  // nested group options) on the final composed strings — no per-label edits in the cells.
  const localizeTools = useCallback(
    (tools) =>
      tools.map((it) => {
        if (!it || it.kind === "sep") return it;
        const out = { ...it };
        if (out.label) out.label = tl(out.label);
        if (out.altLabel) out.altLabel = tl(out.altLabel);
        if (Array.isArray(out.options))
          out.options = out.options.map((o) => (o.label ? { ...o, label: tl(o.label) } : o));
        return out;
      }),
    [tl],
  );

  const value = useMemo(
    () => ({ locale, setLocale, locales: LOCALES, t, tl, localizeTools }),
    [locale, setLocale, t, tl, localizeTools],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
