import { describe, it, expect } from "vitest";
import { cosineSim, rankChunks, formatContext, type IndexChunk } from "./kbIndex.ts";

// A tiny fixture index — three 2-D "vectors" pointing in distinct directions so similarity ordering
// is obvious by inspection. The real index is 384-D, but the math is identical.
const chunk = (id: string, text: string, vector: number[]): IndexChunk => ({
  id,
  source: "test",
  file: "test.md",
  title: "Test",
  heading: id,
  text,
  vector,
});

describe("cosineSim", () => {
  it("is 1 for identical direction (magnitude-independent)", () => {
    expect(cosineSim([1, 0], [3, 0])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("is -1 for opposite direction", () => {
    expect(cosineSim([1, 1], [-1, -1])).toBeCloseTo(-1);
  });

  it("returns 0 when a vector is all zeros (no divide-by-zero)", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
});

describe("rankChunks", () => {
  const chunks = [
    chunk("east", "points east", [1, 0]),
    chunk("north", "points north", [0, 1]),
    chunk("northeast", "points northeast", [1, 1]),
  ];

  it("orders by similarity to the query, highest first", () => {
    const ranked = rankChunks([1, 0.1], chunks, 3);
    expect(ranked.map((c) => c.id)).toEqual(["east", "northeast", "north"]);
  });

  it("caps the result at k", () => {
    const ranked = rankChunks([1, 0], chunks, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("east");
  });

  it("attaches the computed score", () => {
    const ranked = rankChunks([1, 0], chunks, 1);
    expect(ranked[0].score).toBeCloseTo(1);
  });
});

describe("formatContext", () => {
  it("joins chunk texts with a blank line between", () => {
    const scored = rankChunks(
      [1, 0],
      [chunk("a", "## A\nbody a", [1, 0]), chunk("b", "## B\nbody b", [0.9, 0])],
      2,
    );
    expect(formatContext(scored)).toBe("## A\nbody a\n\n## B\nbody b");
  });

  it("is empty for no hits", () => {
    expect(formatContext([])).toBe("");
  });
});
