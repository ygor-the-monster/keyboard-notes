import { describe, it, expect } from "vitest";
import { NOTE_NAMES, pitchClass, midiToFreq, noteToFreq, freqToNote } from "./pitch.ts";

describe("pitchClass", () => {
  it("folds any semitone value into 0–11", () => {
    expect(pitchClass(0)).toBe(0);
    expect(pitchClass(12)).toBe(0);
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(13)).toBe(1);
    expect(pitchClass(-13)).toBe(11);
  });
});

describe("midiToFreq / noteToFreq", () => {
  it("anchors A4 (MIDI 69) to the reference pitch", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 5);
    expect(midiToFreq(69, 442)).toBeCloseTo(442, 5);
  });

  it("rises an octave per 12 semitones", () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 5);
    expect(midiToFreq(57)).toBeCloseTo(220, 5);
  });

  it("maps note index + octave to frequency (A4 = index 9, octave 4)", () => {
    expect(noteToFreq(9, 4)).toBeCloseTo(440, 5);
    expect(noteToFreq(0, 4)).toBeCloseTo(261.626, 2); // C4
  });
});

describe("freqToNote", () => {
  it("maps reference pitches to note / octave / cents", () => {
    expect(freqToNote(440)).toEqual({ note: "A", octave: 4, cents: 0 });
    const c4 = freqToNote(261.626);
    expect(c4.note).toBe("C");
    expect(c4.octave).toBe(4);
    expect(Math.abs(c4.cents)).toBeLessThanOrEqual(1);
  });

  it("respects a custom A4 reference", () => {
    expect(freqToNote(442, 442)).toMatchObject({ note: "A", octave: 4, cents: 0 });
  });

  it("reports cents sharp (+) or flat (−) of the nearest note", () => {
    expect(freqToNote(445).cents).toBeGreaterThan(0);
    expect(freqToNote(435).cents).toBeLessThan(0);
  });

  it("round-trips against noteToFreq", () => {
    expect(freqToNote(noteToFreq(7, 3))).toMatchObject({ note: "G", octave: 3, cents: 0 });
  });
});

describe("NOTE_NAMES", () => {
  it("is the twelve sharp-spelled pitch classes, C first", () => {
    expect(NOTE_NAMES).toHaveLength(12);
    expect(NOTE_NAMES[0]).toBe("C");
    expect(NOTE_NAMES[9]).toBe("A");
  });
});
