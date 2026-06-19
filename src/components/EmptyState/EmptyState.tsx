import general from "./illustrations/general.svg?raw";
import note from "./illustrations/note.svg?raw";
import score from "./illustrations/score.svg?raw";
import cifra from "./illustrations/cifra.svg?raw";
import image from "./illustrations/image.svg?raw";
import pdf from "./illustrations/pdf.svg?raw";
import audio from "./illustrations/audio.svg?raw";
import external from "./illustrations/external.svg?raw";
import { type CSSProperties, type ReactNode } from "react";
import type { Kind } from "../../utils/cellKinds/cellKinds.ts";
import css from "./EmptyState.module.css";

// Reusable empty-state: an inlined illustration (so CSS can recolor it to the surrounding cell's
// --accent and adapt to dark mode) + a title and hint. `kind` picks the artwork; `neutral` swaps
// the accent for a muted grey (used by the app-level / general states).
// Typed `Record<Kind, …>`, so a Kind without artwork is a compile error; `general` is the non-Kind
// fallback for the app-level states.
const KIND_ART: Record<Kind, string> = { note, score, cifra, image, pdf, audio, external };
const artFor = (kind: string): string => (KIND_ART as Record<string, string>)[kind] ?? general;

export default function EmptyState({
  kind,
  title,
  hint,
  compact,
  neutral,
  children,
}: {
  kind: string;
  title?: ReactNode;
  hint?: ReactNode;
  compact?: boolean;
  neutral?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`${css.empty} ${compact ? css.compact : ""}`}
      style={neutral ? ({ "--accent": "var(--s-ink-muted)" } as CSSProperties) : undefined}
    >
      <div
        className={`${css.art} ill`}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: artFor(kind) }}
      />
      {title && <div className={css.title}>{title}</div>}
      {hint && <div className={css.hint}>{hint}</div>}
      {children}
    </div>
  );
}
