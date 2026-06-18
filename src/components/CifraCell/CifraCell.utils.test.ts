import { describe, it, expect } from "vitest";
import { transposeChord, parseCifra, transposeLabel } from "./CifraCell.utils.ts";

describe("transposeChord", () => {
  it("transposes the root", () => {
    expect(transposeChord("C", 2)).toBe("D");
    expect(transposeChord("G", 5)).toBe("C");
  });
  it("keeps quality + extensions", () => {
    expect(transposeChord("Cm7", 2)).toBe("Dm7");
    expect(transposeChord("Cmaj7", 2)).toBe("Dmaj7");
  });
  it("follows the root's accidental spelling (flats stay flat)", () => {
    expect(transposeChord("Bb", 2)).toBe("C");
    expect(transposeChord("Bbm7", 1)).toBe("Bm7");
    expect(transposeChord("F#", 1)).toBe("G");
  });
  it("transposes the slash bass too", () => {
    expect(transposeChord("C/E", 2)).toBe("D/F#");
  });
  it("is a no-op at 0, and leaves tokens not starting A–G untouched", () => {
    expect(transposeChord("F#m", 0)).toBe("F#m");
    // transposeChord trusts its input is a chord (lyric-word filtering happens upstream in
    // isChordLine), so a token that doesn't start on a note letter is returned unchanged.
    expect(transposeChord("xyz", 2)).toBe("xyz");
  });
});

describe("parseCifra", () => {
  it("classifies headings, blanks, plain lines, and chord-over-lyric lines", () => {
    const blocks = parseCifra("{Verse}\n\n[C]Hi [G]there\njust words");
    expect(blocks[0]).toEqual({ type: "heading", text: "Verse" });
    expect(blocks[1]).toEqual({ type: "blank" });
    expect(blocks[2].type).toBe("line");
    expect(blocks[3]).toEqual({ type: "plain", text: "just words" });
  });
  it("splits bracketed chords into transposed segments", () => {
    const blocks = parseCifra("[C]do [G]re", 2);
    const line = blocks[0];
    if (line.type !== "line") throw new Error("expected a line block");
    expect(line.segs.map((s) => s.chord)).toEqual(["D", "A"]);
    expect(line.segs[0].text).toBe("do ");
  });
});

describe("transposeLabel", () => {
  it("formats the offset", () => {
    expect(transposeLabel(0)).toBe("0");
    expect(transposeLabel(2)).toBe("+2");
    expect(transposeLabel(-3)).toBe("−3");
  });
});
