// The model side of the Cell-kind registry: the closed set of Kinds, the Cell discriminated
// union, the pure factories, and the kind -> factory map. React-free, so the store/reducer can
// import it without dragging in component-land. The view side lives in registry.tsx.
import { uid } from "../cellId/cellId.ts";
import type { LessonStatus } from "../lessonStatus/lessonStatus.ts";

// Single source of truth for the closed set of kinds. `as const` makes it erasable and lets
// `Kind` be derived from it — never a TS enum (forbidden under erasableSyntaxOnly).
export const KINDS = ["note", "score", "cifra", "image", "pdf", "audio", "external"] as const;
export type Kind = (typeof KINDS)[number];

// ---- Shared value shapes ----------------------------------------------------------------

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Non-destructive Image Filter: reversible transform params, applied at render time over the
// preserved Original. Never baked into the bytes.
export interface ImageFilter {
  rotate: number; // 0 | 90 | 180 | 270 (clockwise degrees)
  flipH: boolean;
  flipV: boolean;
  crop: Crop | null; // normalised over the flipped+rotated image, or null
  bright: number; // integer steps -> CSS filter multiplier
  contrast: number;
  sat: number;
}

// One freehand line within an Annotation. Coordinates are normalised [0,1] to the layer box.
export interface AnnotationStroke {
  color: string;
  width: number;
  opacity: number;
  points: [number, number][];
}

// A saved point (or region) in time on an Audio Cell.
export interface Mark {
  id: string;
  time: number;
  end?: number;
  color?: string;
  label?: string;
  kind?: "region" | "point";
}

// ---- The Cell discriminated union (on `kind`) -------------------------------------------

export interface NoteCell {
  id: string;
  kind: "note";
  source: string;
}
export interface ScoreCell {
  id: string;
  kind: "score";
  header: string;
  body: string;
}
export interface CifraCell {
  id: string;
  kind: "cifra";
  source: string;
  transpose: number;
}
export interface ImageCell {
  id: string;
  kind: "image";
  dataUrl: string;
  filter: ImageFilter;
  strokes: AnnotationStroke[];
}
export interface PdfCell {
  id: string;
  kind: "pdf";
  dataUrl: string;
  url: string;
  name: string;
  height: number;
  annotations: Record<number, AnnotationStroke[]>; // per-page overlay
}
export interface AudioCell {
  id: string;
  kind: "audio";
  dataUrl: string;
  marks: Mark[];
}
// External points *outside* the notebook (a video or web page) rather than holding bytes — the one
// kind that isn't offline-self-contained, so it carries an offline fallback in its view. `title` is
// a maker-supplied label shown in the offline placeholder and link card; `url` is the source.
export interface ExternalCell {
  id: string;
  kind: "external";
  url: string;
  title: string;
}

export type Cell =
  | NoteCell
  | ScoreCell
  | CifraCell
  | ImageCell
  | PdfCell
  | AudioCell
  | ExternalCell;
export type CellOf<K extends Kind> = Extract<Cell, { kind: K }>;

// ---- Lesson / app state -----------------------------------------------------------------

export interface Lesson {
  id: string;
  title: string;
  created: number;
  updated: number;
  cells: Cell[];
  // Library organization (ADR-0005). All optional + additive, so old records/files load unchanged.
  // `pinned` floats the Lesson to the top of the Library; `tags` are normalized (see lessonTags);
  // `status` is the workflow badge, where "template" marks the Lesson reusable (see lessonStatus).
  // Editing any of these is organizing, not editing — none bumps `updated`.
  pinned?: boolean;
  tags?: string[];
  status?: LessonStatus;
}

export interface AppState {
  lessons: Record<string, Lesson>;
  order: string[];
  activeId: string | null;
}

// ---- Factories (pure, zero-arg) ---------------------------------------------------------
// Each produces an empty default Cell; the empty states in the UI carry the first-run prompt.

const DEFAULT_SCORE_HEADER =
  "X:1\nM:4/4\nL:1/4\nQ:1/4=90\n%%score { (RH) (LH) }\nV:RH clef=treble\nV:LH clef=bass\nK:C";

export const DEFAULT_IMAGE_FILTER: ImageFilter = {
  rotate: 0,
  flipH: false,
  flipV: false,
  crop: null,
  bright: 0,
  contrast: 0,
  sat: 0,
};

export const newNoteCell = (): NoteCell => ({ id: uid(), kind: "note", source: "" });

export const newScoreCell = (): ScoreCell => ({
  id: uid(),
  kind: "score",
  header: DEFAULT_SCORE_HEADER,
  body: "",
});

export const newCifraCell = (): CifraCell => ({
  id: uid(),
  kind: "cifra",
  source: "",
  transpose: 0,
});

export const newImageCell = (): ImageCell => ({
  id: uid(),
  kind: "image",
  dataUrl: "",
  filter: { ...DEFAULT_IMAGE_FILTER },
  strokes: [],
});

export const newPdfCell = (): PdfCell => ({
  id: uid(),
  kind: "pdf",
  dataUrl: "",
  url: "",
  name: "",
  height: 480,
  annotations: {},
});

export const newAudioCell = (): AudioCell => ({ id: uid(), kind: "audio", dataUrl: "", marks: [] });

export const newExternalCell = (): ExternalCell => ({
  id: uid(),
  kind: "external",
  url: "",
  title: "",
});

// kind -> factory. Typed `Record<Kind, …>`, so adding a Kind to KINDS without an entry here is
// a compile error under tsgo — the maps cannot drift.
export const cellKinds: Record<Kind, { factory: () => Cell }> = {
  note: { factory: newNoteCell },
  score: { factory: newScoreCell },
  cifra: { factory: newCifraCell },
  image: { factory: newImageCell },
  pdf: { factory: newPdfCell },
  audio: { factory: newAudioCell },
  external: { factory: newExternalCell },
};

// A fresh Lesson is empty — the general empty state prompts the first Cell.
export const defaultLesson = (): Lesson => {
  const t = Date.now();
  return { id: uid(), title: "", created: t, updated: t, cells: [] };
};

// ---- Validation / coercion (pure) -------------------------------------------------------
// Used at the two trust boundaries — importing a file and loading a persisted record — and for
// patching a Cell. Pure and React-free, so they can be unit-tested without the store/UI.

type Checker = (v: unknown) => boolean;
const isStr: Checker = (v) => typeof v === "string";
const isNum: Checker = (v) => typeof v === "number" && Number.isFinite(v);
const isArr: Checker = (v) => Array.isArray(v);
const isObj: Checker = (v) => !!v && typeof v === "object" && !Array.isArray(v);

// The mutable data fields per kind, with the type each must hold. Excludes `id` and the `kind`
// discriminant (which must never change). Drives both `applyCellPatch` (allowlist) and
// `validateCell` (repair table) so the two can't drift from the Cell union above.
const cellFields: Record<Kind, Record<string, Checker>> = {
  note: { source: isStr },
  score: { header: isStr, body: isStr },
  cifra: { source: isStr, transpose: isNum },
  image: { dataUrl: isStr, filter: isObj, strokes: isArr },
  pdf: { dataUrl: isStr, url: isStr, name: isStr, height: isNum, annotations: isObj },
  audio: { dataUrl: isStr, marks: isArr },
  external: { url: isStr, title: isStr },
};

const isKind = (v: unknown): v is Kind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);

// Apply a partial patch to a Cell, copying only fields that belong to the cell's kind. The `kind`
// discriminant and `id` are never patchable, so a stray/hostile patch can't corrupt the union.
export function applyCellPatch<C extends Cell>(cell: C, patch: Partial<Cell>): C {
  const allowed = cellFields[cell.kind];
  const next = { ...cell } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (key in allowed) next[key] = (patch as Record<string, unknown>)[key];
  }
  return next as C;
}

// Coerce an untrusted value into a valid Cell, or null if it isn't salvageable (not an object, or
// an unknown kind). For a known kind we start from a fresh default (giving every required field a
// valid value + a fresh id) and copy over each incoming field that is present with the right type —
// so a slightly-damaged cell is repaired rather than dropped, and original ids are preserved.
export function validateCell(value: unknown): Cell | null {
  if (!isObj(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isKind(raw.kind)) return null;
  const base = cellKinds[raw.kind].factory() as unknown as Record<string, unknown>;
  if (isStr(raw.id) && raw.id) base.id = raw.id;
  for (const [field, ok] of Object.entries(cellFields[raw.kind])) {
    if (field in raw && ok(raw[field])) base[field] = raw[field];
  }
  return base as unknown as Cell;
}

// What `coerceLesson` returns: the sanitized Lesson plus how many cells were dropped (unknown kind
// or non-object), so the caller can warn the user. Returns null when the value isn't a Lesson at
// all (not an object, or no `cells` array).
export interface CoercedLesson {
  lesson: Lesson;
  dropped: number;
}

// Coerce an untrusted value into a Lesson with only valid cells. Leaves id/created/updated/tags to
// the caller (the store mints/normalizes those on import); here we guarantee a string title and a
// cells array of valid Cells.
export function coerceLesson(value: unknown): CoercedLesson | null {
  if (!isObj(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isArr(raw.cells)) return null;
  const input = raw.cells as unknown[];
  const cells = input.map(validateCell).filter((c): c is Cell => c !== null);
  const lesson = { ...(raw as object) } as Lesson;
  lesson.cells = cells;
  if (!isStr(lesson.title)) lesson.title = "";
  return { lesson, dropped: input.length - cells.length };
}
