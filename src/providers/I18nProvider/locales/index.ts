import en from "./en.ts";
import pt from "./pt.ts";
import es from "./es.ts";
import fr from "./fr.ts";
import de from "./de.ts";
import it from "./it.ts";

// pt = Brazilian Portuguese (pt-BR). Locale codes are the two-letter base so
// navigator.language detection ("pt-BR", "es-419", …) matches on the prefix.
export const MESSAGES = { en, pt, es, fr, de, it };
export const LOCALES = ["en", "pt", "es", "fr", "de", "it"];
export const DEFAULT_LOCALE = "en";
