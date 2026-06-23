import { describe, it, expect } from "vitest";
import {
  LESSON_STATUSES,
  DEFAULT_STATUS,
  normalizeStatus,
  effectiveStatus,
  normalizeLessonStatus,
  isTemplate,
  type LessonStatus,
} from "./lessonStatus.ts";

describe("normalizeStatus", () => {
  it("accepts each storable status", () => {
    for (const st of ["new", "in_progress", "in_review", "done", "archived", "template"] as const) {
      expect(normalizeStatus(st)).toBe(st);
    }
  });

  it("treats the 'no_status' sentinel as absent (never stored)", () => {
    expect(normalizeStatus("no_status")).toBeUndefined();
    expect(DEFAULT_STATUS).toBe("no_status");
  });

  it("drops unknown / non-string values (incl. corrupt imports)", () => {
    expect(normalizeStatus("archive")).toBeUndefined();
    expect(normalizeStatus(42)).toBeUndefined();
    expect(normalizeStatus(null)).toBeUndefined();
    expect(normalizeStatus(undefined)).toBeUndefined();
  });
});

describe("effectiveStatus", () => {
  it("reads an absent field as 'No Status'", () => {
    expect(effectiveStatus({})).toBe("no_status");
  });

  it("returns the stored status when present", () => {
    expect(effectiveStatus({ status: "done" })).toBe("done");
  });
});

describe("normalizeLessonStatus", () => {
  it("keeps a valid status in place", () => {
    const lesson: { status?: LessonStatus } = { status: "in_review" };
    normalizeLessonStatus(lesson);
    expect(lesson.status).toBe("in_review");
  });

  it("clears an invalid status carried in from a record/import", () => {
    const lesson = { status: "bogus" as LessonStatus };
    normalizeLessonStatus(lesson);
    expect(lesson.status).toBeUndefined();
  });

  it("leaves a status-less lesson untouched (no field added)", () => {
    const lesson: { status?: LessonStatus } = {};
    normalizeLessonStatus(lesson);
    expect(lesson.status).toBeUndefined();
  });
});

describe("isTemplate", () => {
  it("is true only for status='template'", () => {
    expect(isTemplate({ status: "template" })).toBe(true);
    expect(isTemplate({ status: "done" })).toBe(false);
    expect(isTemplate({})).toBe(false);
  });
});

describe("LESSON_STATUSES", () => {
  it("lists all seven picker values in workflow order", () => {
    expect(LESSON_STATUSES).toEqual([
      "no_status",
      "new",
      "in_progress",
      "in_review",
      "done",
      "archived",
      "template",
    ]);
  });
});
