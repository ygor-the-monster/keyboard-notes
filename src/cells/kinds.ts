// The model side of the Cell-kind registry: the closed set of Kinds, the Cell discriminated
// union, the pure factories, and the kind -> factory map. React-free, so the store/reducer can
// import it without dragging in component-land. The view side lives in registry.tsx.
import { uid } from "./id.ts";

// Single source of truth for the closed set of kinds. `as const` makes it erasable and lets
// `Kind` be derived from it — never a TS enum (forbidden under erasableSyntaxOnly).
export const KINDS = ["note", "score", "cifra", "image", "pdf", "audio"] as const;
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

export type Cell = NoteCell | ScoreCell | CifraCell | ImageCell | PdfCell | AudioCell;
export type CellOf<K extends Kind> = Extract<Cell, { kind: K }>;

// ---- Lesson / app state -----------------------------------------------------------------

export interface Lesson {
  id: string;
  title: string;
  created: number;
  updated: number;
  cells: Cell[];
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

// kind -> factory. Typed `Record<Kind, …>`, so adding a Kind to KINDS without an entry here is
// a compile error under tsgo — the maps cannot drift.
export const cellKinds: Record<Kind, { factory: () => Cell }> = {
  note: { factory: newNoteCell },
  score: { factory: newScoreCell },
  cifra: { factory: newCifraCell },
  image: { factory: newImageCell },
  pdf: { factory: newPdfCell },
  audio: { factory: newAudioCell },
};

// A fresh Lesson is empty — the general empty state prompts the first Cell.
export const defaultLesson = (): Lesson => {
  const t = Date.now();
  return { id: uid(), title: "", created: t, updated: t, cells: [] };
};
