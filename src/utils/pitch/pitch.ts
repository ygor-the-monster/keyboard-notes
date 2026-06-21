// Equal-temperament pitch math — the one home for note↔frequency conversion and the chromatic
// (modulo-12) wrap. The Tuner (frequency → note), the Drone (note → frequency), and the chord
// tools (pitch-class arithmetic) all reach through here, so the A4 reference and the 12-tone scale
// can't drift across them. Pure and React-free.

// The twelve pitch classes, sharp-spelled with the unicode sharp (♯). Index 0 = C.
export const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// Fold any (possibly negative) semitone value into a pitch class 0–11.
export const pitchClass = (n: number): number => ((n % 12) + 12) % 12;

// MIDI note number → frequency, referenced to a tunable A4 (MIDI 69).
export const midiToFreq = (midi: number, a4 = 440): number => a4 * 2 ** ((midi - 69) / 12);

// Note index (0 = C) + octave → frequency. Octave 4 starts at MIDI 60 (C4), so A4 (index 9) = 69.
export const noteToFreq = (noteIdx: number, octave: number, a4 = 440): number =>
  midiToFreq((octave + 1) * 12 + noteIdx, a4);

// Common scales / modes as semitone offsets from the root — used by the Drone's scale reference.
export const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentMajor: [0, 2, 4, 7, 9],
  pentMinor: [0, 3, 5, 7, 10],
};

export interface NoteReading {
  note: string;
  octave: number;
  cents: number; // signed distance from the nearest note: + sharp, − flat
}

// Frequency → { note, octave, cents } via the equal-tempered scale, referenced to a tunable A4.
export function freqToNote(hz: number, a4 = 440): NoteReading {
  const midi = 69 + 12 * Math.log2(hz / a4);
  const nearest = Math.round(midi);
  return {
    note: NOTE_NAMES[pitchClass(nearest)],
    octave: Math.floor(nearest / 12) - 1,
    cents: Math.round((midi - nearest) * 100),
  };
}
