import { describe, it, expect } from "vitest";
import {
  serializeLesson,
  serializeLibrary,
  lessonFilename,
  EXPORT_VERSION,
} from "./lessonExport.ts";
import type { AppState, Lesson } from "../cellKinds/cellKinds.ts";

const lesson = (id: string, title: string): Lesson => ({
  id,
  title,
  created: 1,
  updated: 2,
  cells: [{ id: "c1", kind: "note", source: "# hi" }],
});

describe("serializeLesson", () => {
  it("wraps the lesson in the branded, versioned envelope", () => {
    const parsed = JSON.parse(serializeLesson(lesson("l1", "Scales")));
    expect(parsed).toMatchObject({ app: "pianoNotes", version: EXPORT_VERSION });
    expect(parsed.lesson.id).toBe("l1");
    expect(parsed.lesson.cells).toHaveLength(1);
  });

  it("round-trips a lesson unchanged through serialize → parse", () => {
    const original = lesson("l1", "Scales");
    expect(JSON.parse(serializeLesson(original)).lesson).toEqual(original);
  });
});

describe("serializeLibrary", () => {
  it("wraps every lesson and its order in the library envelope", () => {
    const state: AppState = {
      lessons: { a: lesson("a", "A"), b: lesson("b", "B") },
      order: ["b", "a"],
      activeId: "b",
    };
    const parsed = JSON.parse(serializeLibrary(state));
    expect(parsed).toMatchObject({ app: "pianoNotes", version: EXPORT_VERSION });
    expect(parsed.library.order).toEqual(["b", "a"]);
    expect(Object.keys(parsed.library.lessons)).toEqual(["a", "b"]);
    // The transient activeId is a UI concern, not part of a portable backup.
    expect(parsed.library).not.toHaveProperty("activeId");
  });
});

describe("lessonFilename", () => {
  it("sanitizes the title into a .pnotes filename", () => {
    expect(lessonFilename(lesson("l1", "Czerny No. 1!"))).toBe("Czerny_No_1_.pnotes");
  });

  it("falls back to a default name for an empty title or null lesson", () => {
    expect(lessonFilename(lesson("l1", ""))).toBe("lesson.pnotes");
    expect(lessonFilename(null)).toBe("lesson.pnotes");
  });
});
