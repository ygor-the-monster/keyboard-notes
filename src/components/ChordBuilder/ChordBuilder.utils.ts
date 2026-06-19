// Name a chord from a set of selected notes. Each note is an absolute semitone value (pitch class
// + 12·octave), so the genuinely lowest note acts as the bass: it drives inversion / slash naming
// (e.g. C/E vs C). Tries each unique pitch class as the root, matching the interval set against
// common chord shapes; if the root isn't the bass it's shown as a slash. Unknown sets list names.
import { NOTE_NAMES, pitchClass } from "../../utils/pitch/pitch.ts";

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

const eq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function identifyChord(set: Set<number> | number[]): string {
  const notes = [...set].sort((a, b) => a - b);
  if (!notes.length) return "—";
  const bass = pitchClass(notes[0]); // pitch class of the genuinely lowest note
  const pcs = [...new Set(notes.map(pitchClass))].sort((a, b) => a - b);
  if (pcs.length === 1) return NOTE_NAMES[pcs[0]];
  for (const root of pcs) {
    const ivals = pcs.map((pc) => pitchClass(pc - root)).sort((a, b) => a - b);
    const match = CHORDS.find(([, iv]) => eq(ivals, iv));
    if (match) {
      const name = NOTE_NAMES[root] + match[0];
      return root !== bass ? `${name}/${NOTE_NAMES[bass]}` : name;
    }
  }
  return pcs.map((pc) => NOTE_NAMES[pc]).join(" · ");
}
