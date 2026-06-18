import { describe, it, expect, beforeAll } from "vitest";
import { getAbcjs, smartNote, wrapNotes } from "./ScoreCell.utils.ts";

// smartNote / wrapNotes locate the targeted note(s) via abcjs.parseOnly's parse tree, so they
// only do anything once abcjs is actually loaded. abcjs touches the DOM on import, so this runs
// in the browser project (not jsdom). The other ScoreCell.utils helpers are pure → unit tests.
const HEADER = "X:1\nK:C";
const BODY = "C D E F |";

beforeAll(async () => {
  await getAbcjs();
});

describe("smartNote (real abcjs parse tree)", () => {
  it("raises the targeted note an octave (appends ')", () => {
    const out = smartNote(HEADER, BODY, 0, 0, "octave", 1);
    expect(out?.startsWith("C'")).toBe(true);
  });

  it("lowers the targeted note an octave (appends ,)", () => {
    const out = smartNote(HEADER, BODY, 0, 0, "octave", -1);
    expect(out?.startsWith("C,")).toBe(true);
  });

  it("sets an accidental on the targeted note", () => {
    const out = smartNote(HEADER, BODY, 0, 0, "accidental", "^");
    expect(out?.startsWith("^C")).toBe(true);
  });

  it("sets a length on the targeted note", () => {
    const out = smartNote(HEADER, BODY, 0, 0, "length", "2");
    expect(out?.startsWith("C2")).toBe(true);
  });

  it("returns null when the target is a rest (no pitch to shift)", () => {
    expect(smartNote(HEADER, "z4 |", 0, 1, "octave", 1)).toBeNull();
  });

  it("returns null when there is no note to act on", () => {
    expect(smartNote(HEADER, "", 0, 0, "octave", 1)).toBeNull();
  });
});

describe("wrapNotes (real abcjs parse tree)", () => {
  it("wraps a selection of notes into a chord", () => {
    const out = wrapNotes(HEADER, BODY, 0, 3, "chord");
    expect(out).toContain("[CD]");
  });

  it("wraps a selection of notes into a slur", () => {
    const out = wrapNotes(HEADER, BODY, 0, 3, "slur");
    expect(out).toContain("(C D)");
  });

  it("returns null when the selection covers no notes", () => {
    expect(wrapNotes(HEADER, "", 0, 0, "chord")).toBeNull();
  });
});
