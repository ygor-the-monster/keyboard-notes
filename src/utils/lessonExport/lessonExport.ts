// Serialization for the export / share / backup paths. Device-local data has no cloud copy, so the
// `.pnotes` file these produce is the only backup-and-transfer bridge — its shape is load-bearing
// and must stay in lockstep with what StoreProvider.importLesson / importLibrary accept. Kept as
// pure functions (no DOM, no React) so the real exporter is unit-testable, not just a UI handler.
import type { AppState, Lesson } from "../cellKinds/cellKinds.ts";

// Bumped when the on-disk envelope changes shape. `app` brands the file as ours; importers read
// `.lesson` / `.library` off the parsed envelope.
export const EXPORT_VERSION = 3;
const APP_TAG = "pianoNotes";

// One Lesson, as written by Export and Share. Pretty-printed — these files are human-inspectable.
export function serializeLesson(lesson: Lesson): string {
  return JSON.stringify({ app: APP_TAG, version: EXPORT_VERSION, lesson }, null, 2);
}

// The whole Library (every Lesson + their order), as written by the backup safety net.
export function serializeLibrary(state: Pick<AppState, "lessons" | "order">): string {
  const library = { lessons: state.lessons, order: state.order };
  return JSON.stringify({ app: APP_TAG, version: EXPORT_VERSION, library }, null, 2);
}

// A filesystem-safe download name derived from the Lesson title, e.g. "Czerny No. 1" → "Czerny_No_1".
export function lessonFilename(lesson: Lesson | null): string {
  return (lesson?.title || "lesson").replace(/[^\w-]+/g, "_") + ".pnotes";
}
