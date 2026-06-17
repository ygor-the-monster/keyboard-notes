import general from "./illustrations/general.svg?raw";
import note from "./illustrations/note.svg?raw";
import score from "./illustrations/score.svg?raw";
import chords from "./illustrations/chords.svg?raw";
import image from "./illustrations/image.svg?raw";
import pdf from "./illustrations/pdf.svg?raw";
import audio from "./illustrations/audio.svg?raw";
import css from "./EmptyState.module.css";

// Reusable empty-state: an inlined illustration (so CSS can recolor it to the surrounding
// cell's --accent and adapt to dark mode) + a title and hint. `kind` picks the artwork;
// `neutral` swaps the accent for a muted grey (used by the app-level / general states).
const ART = { general, note, score, chords, image, pdf, audio };

export default function EmptyState({ kind, title, hint, compact, neutral, children }) {
  return (
    <div
      className={`${css.empty} ${compact ? css.compact : ""}`}
      style={neutral ? { "--accent": "var(--s-ink-muted)" } : undefined}
    >
      <div className={`${css.art} ill`} aria-hidden dangerouslySetInnerHTML={{ __html: ART[kind] }} />
      {title && <div className={css.title}>{title}</div>}
      {hint && <div className={css.hint}>{hint}</div>}
      {children}
    </div>
  );
}
