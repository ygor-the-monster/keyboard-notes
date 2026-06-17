import en from "./en.js";
import pt from "./pt.js";
import es from "./es.js";
import fr from "./fr.js";
import de from "./de.js";

// pt = Brazilian Portuguese (pt-BR). Locale codes are the two-letter base so
// navigator.language detection ("pt-BR", "es-419", …) matches on the prefix.
export const MESSAGES = { en, pt, es, fr, de };
export const LOCALES = ["en", "pt", "es", "fr", "de"];
export const DEFAULT_LOCALE = "en";
