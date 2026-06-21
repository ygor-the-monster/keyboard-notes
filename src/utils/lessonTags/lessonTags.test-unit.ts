import { describe, it, expect } from "vitest";
import { normalizeTags, normalizeLessonTags } from "./lessonTags.ts";

describe("normalizeTags", () => {
  it("lowercases, trims, collapses whitespace, de-dupes, and sorts", () => {
    expect(normalizeTags(["Bach", "bach ", "  scales", "Sight   Reading"])).toEqual([
      "bach",
      "scales",
      "sight reading",
    ]);
  });

  it("drops empties and non-string entries", () => {
    expect(normalizeTags(["ok", "", "   ", 42, null, undefined, { x: 1 }])).toEqual(["ok"]);
  });

  it("returns an empty array for non-array input (incl. corrupt imports)", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags("scales")).toEqual([]);
    expect(normalizeTags(null)).toEqual([]);
  });

  it("caps tag length", () => {
    const long = "a".repeat(50);
    expect(normalizeTags([long])[0]).toHaveLength(32);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: 40 }, (_, i) => `t${String(i).padStart(2, "0")}`);
    expect(normalizeTags(many)).toHaveLength(24);
  });
});

describe("normalizeLessonTags", () => {
  it("normalizes tags in place when present", () => {
    const lesson = { tags: ["B", "b", "a"] };
    normalizeLessonTags(lesson);
    expect(lesson.tags).toEqual(["a", "b"]);
  });

  it("leaves an untagged lesson untouched (no tags field added)", () => {
    const lesson: { tags?: string[] } = {};
    normalizeLessonTags(lesson);
    expect(lesson.tags).toBeUndefined();
  });
});
