// Chord analysis + reverse lookup + instrument fingerings for the ChordBuilder. Each selected note
// is an absolute semitone value (pitch class + 12·octave), so the genuinely lowest note acts as the
// bass: it drives inversion / slash naming. Pure and React-free.
import { NOTE_NAMES, pitchClass } from "../../utils/pitch/pitch.ts";

// Chord shapes as interval sets (semitones above the root). "" = major triad.
const CHORDS: [string, number[]][] = [
  ["", [0, 4, 7]],
  ["m", [0, 3, 7]],
  ["dim", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["sus2", [0, 2, 7]],
  ["sus4", [0, 5, 7]],
  ["6", [0, 4, 7, 9]],
  ["m6", [0, 3, 7, 9]],
  ["7", [0, 4, 7, 10]],
  ["maj7", [0, 4, 7, 11]],
  ["m7", [0, 3, 7, 10]],
  ["m7♭5", [0, 3, 6, 10]],
  ["dim7", [0, 3, 6, 9]],
  ["add9", [0, 2, 4, 7]],
  ["7sus4", [0, 5, 7, 10]],
];

// Chord-tone label per semitone interval from the root (chord context, not strict interval names).
const TONE_LABELS = ["R", "♭9", "9", "♭3", "3", "11", "♭5", "5", "♯5", "6", "♭7", "7"];

const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

// Find the root pitch class + chord symbol for a set of pitch classes, or null if no shape matches.
function matchChord(pcs: number[]): { rootPc: number; sym: string } | null {
  for (const root of pcs) {
    const ivals = pcs.map((pc) => pitchClass(pc - root)).sort((a, b) => a - b);
    const match = CHORDS.find(([, iv]) => eq(ivals, iv));
    if (match) return { rootPc: root, sym: match[0] };
  }
  return null;
}

export function identifyChord(set: Set<number> | number[]): string {
  const notes = [...set].sort((a, b) => a - b);
  if (!notes.length) return "—";
  const bass = pitchClass(notes[0]);
  const pcs = [...new Set(notes.map(pitchClass))].sort((a, b) => a - b);
  if (pcs.length === 1) return NOTE_NAMES[pcs[0]];
  const m = matchChord(pcs);
  if (m) {
    const name = NOTE_NAMES[m.rootPc] + m.sym;
    return m.rootPc !== bass ? `${name}/${NOTE_NAMES[bass]}` : name;
  }
  return pcs.map((pc) => NOTE_NAMES[pc]).join(" · ");
}

export interface ChordTone {
  pc: number;
  name: string;
  tone: string; // R, 3, 5, ♭7 …
}
export interface ChordAnalysis {
  name: string;
  rootPc: number;
  sym: string | null; // matched quality ("" = major), or null if the set isn't a known chord
  tones: ChordTone[]; // root-first, then ascending by interval
}

// Spelling + intervals for a selected set (or null when empty / a single note).
export function analyzeChord(set: Set<number> | number[]): ChordAnalysis | null {
  const notes = [...set].sort((a, b) => a - b);
  if (notes.length < 2) return null;
  const pcs = [...new Set(notes.map(pitchClass))];
  const m = matchChord(pcs);
  const rootPc = m ? m.rootPc : pitchClass(notes[0]);
  const tones = [...pcs]
    .sort((a, b) => pitchClass(a - rootPc) - pitchClass(b - rootPc))
    .map((pc) => ({ pc, name: NOTE_NAMES[pc], tone: TONE_LABELS[pitchClass(pc - rootPc)] }));
  return { name: identifyChord(set), rootPc, sym: m ? m.sym : null, tones };
}

// Reverse lookup: chord qualities for the picker (id "maj" stands in for the empty major symbol).
export const QUALITIES = CHORDS.map(([sym, ivals]) => ({ id: sym || "maj", sym, ivals }));

// Pitch classes for a root + quality symbol (for reverse lookup → keyboard highlight).
export function chordPcs(rootPc: number, sym: string): number[] {
  const ivals = CHORDS.find(([s]) => s === sym)?.[1] ?? [0, 4, 7];
  return ivals.map((i) => pitchClass(rootPc + i));
}

// ----- Instrument fingerings (movable shapes, transposed by root) -----
interface Shape {
  rel: (number | null)[]; // frets relative to the shape's base root, per string low→high; null = muted
  baseRoot: number; // pitch class of the root in the un-shifted shape
}
// Frets per string for the diagrams; null = muted, 0 = open.
const GUITAR_SHAPES: Record<string, Shape[]> = {
  maj: [{ rel: [0, 2, 2, 1, 0, 0], baseRoot: 4 }, { rel: [null, 0, 2, 2, 2, 0], baseRoot: 9 }],
  m: [{ rel: [0, 2, 2, 0, 0, 0], baseRoot: 4 }, { rel: [null, 0, 2, 2, 1, 0], baseRoot: 9 }],
  "7": [{ rel: [0, 2, 0, 1, 0, 0], baseRoot: 4 }, { rel: [null, 0, 2, 0, 2, 0], baseRoot: 9 }],
  m7: [{ rel: [0, 2, 0, 0, 0, 0], baseRoot: 4 }, { rel: [null, 0, 2, 0, 1, 0], baseRoot: 9 }],
  maj7: [{ rel: [0, 2, 1, 1, 0, 0], baseRoot: 4 }, { rel: [null, 0, 2, 1, 2, 0], baseRoot: 9 }],
  sus4: [{ rel: [0, 2, 2, 2, 0, 0], baseRoot: 4 }],
  sus2: [{ rel: [0, 2, 4, 4, 0, 0], baseRoot: 4 }],
};
const UKE_SHAPES: Record<string, Shape[]> = {
  maj: [{ rel: [0, 0, 0, 3], baseRoot: 0 }],
  m: [{ rel: [2, 0, 0, 0], baseRoot: 9 }],
  "7": [{ rel: [0, 1, 0, 0], baseRoot: 9 }],
  maj7: [{ rel: [0, 0, 0, 2], baseRoot: 0 }],
  m7: [{ rel: [0, 0, 0, 0], baseRoot: 9 }],
};

export type Instrument = "guitar" | "ukulele";

// Absolute frets per string for a root + quality, or null if no movable shape covers that quality.
export function fingering(rootPc: number, sym: string, instrument: Instrument): (number | null)[] | null {
  const q = sym || "maj";
  const shapes = (instrument === "guitar" ? GUITAR_SHAPES : UKE_SHAPES)[q];
  if (!shapes) return null;
  let best: { frets: (number | null)[]; maxF: number } | null = null;
  for (const sh of shapes) {
    const shift = (((rootPc - sh.baseRoot) % 12) + 12) % 12;
    const frets = sh.rel.map((r) => (r == null ? null : r + shift));
    const maxF = Math.max(...frets.map((f) => f ?? 0));
    if (!best || maxF < best.maxF) best = { frets, maxF };
  }
  return best ? best.frets : null;
}
