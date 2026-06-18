import { describe, it, expect } from "vitest";
import {
  splitAbc,
  joinAbc,
  staffIds,
  addStaff,
  removeStaff,
  parseTempo,
  withTempo,
  cleanAbc,
  smartNote,
  wrapNotes,
} from "./ScoreCell.utils.ts";

describe("splitAbc / joinAbc", () => {
  it("splits at the K: line and round-trips", () => {
    const src = "X:1\nM:4/4\nK:C\n[V:RH] C D";
    const { header, body } = splitAbc(src);
    expect(header).toBe("X:1\nM:4/4\nK:C");
    expect(body).toBe("[V:RH] C D");
    expect(joinAbc(header, body)).toBe(src);
  });
  it("treats a source with no K: as all header", () => {
    expect(splitAbc("CDEF")).toEqual({ header: "CDEF", body: "" });
  });
});

describe("staffIds", () => {
  it("collects distinct voice ids from header and body", () => {
    expect(staffIds("V:RH clef=treble\nV:LH clef=bass\nK:C", "[V:RH] C\n[V:LH] C,")).toEqual([
      "RH",
      "LH",
    ]);
  });
});

describe("addStaff / removeStaff", () => {
  it("adds a staff, then removeStaff drops back to one", () => {
    const header = "X:1\n%%score (RH)\nV:RH clef=treble\nK:C";
    const added = addStaff(header, "[V:RH] C D", "bass");
    expect(staffIds(added.header, added.body).length).toBe(2);
    const removed = removeStaff(added.header, added.body);
    expect(staffIds(removed.header, removed.body).length).toBe(1);
  });
  it("never removes the last staff", () => {
    const r = removeStaff("V:RH clef=treble\nK:C", "[V:RH] C");
    expect(staffIds(r.header, r.body).length).toBe(1);
  });
});

describe("parseTempo / withTempo", () => {
  it("reads Q:1/4=120, Q:90, and the fallback", () => {
    expect(parseTempo("Q:1/4=120\nK:C")).toBe(120);
    expect(parseTempo("Q:90\nK:C")).toBe(90);
    expect(parseTempo("K:C", 70)).toBe(70);
  });
  it("replaces an existing Q:, else inserts after K:", () => {
    expect(withTempo("Q:1/4=90\nK:C", 120)).toBe("Q:1/4=120\nK:C");
    expect(withTempo("X:1\nK:C", 100)).toContain("Q:1/4=100");
  });
});

describe("cleanAbc", () => {
  it("drops blank lines (a blank line would end the tune)", () => {
    expect(cleanAbc("X:1\n\nK:C\n\n[V:RH] C")).toBe("X:1\nK:C\n[V:RH] C");
  });
});

describe("smart-note editing without abcjs loaded", () => {
  // abcjs is lazy; before it loads, the smart editors return null so the caller falls back
  // to a plain insert. (The note-walking itself needs the parser, exercised in the app.)
  it("returns null", () => {
    expect(smartNote("K:C", "C D E", 0, 1, "octave", 1)).toBeNull();
    expect(wrapNotes("K:C", "C D E", 0, 5, "chord")).toBeNull();
  });
});
