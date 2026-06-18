import { describe, it, expect } from "vitest";
import { identifyChord } from "./ChordBuilder.utils.ts";

// Notes are absolute semitones (pitch class + 12·octave); 12 = middle C.
describe("identifyChord", () => {
  it("names triads", () => {
    expect(identifyChord(new Set([12, 16, 19]))).toBe("C"); // C E G
    expect(identifyChord(new Set([12, 15, 19]))).toBe("Cm"); // C E♭ G
  });
  it("names sevenths", () => {
    expect(identifyChord(new Set([12, 16, 19, 22]))).toBe("C7"); // C E G B♭
  });
  it("uses slash naming when the bass isn't the root", () => {
    expect(identifyChord(new Set([4, 12, 16, 19]))).toBe("C/E"); // C major over a low E
  });
  it("handles empty and unknown sets", () => {
    expect(identifyChord(new Set())).toBe("—");
    expect(identifyChord(new Set([0, 1]))).toBe("C · C♯");
  });
});
