// The single place a Lesson's workflow status is defined and normalized (ADR-0005 organization
// pattern, like lessonTags). Status is one of a closed set; like `pinned`/`tags` it's additive +
// optional, so old records/files load unchanged, and editing it is organizing — not editing — so
// it never bumps `updated`. Setting status to "template" is what flags a Lesson as reusable: the
// Library offers "new from template" for any such Lesson. Pure and DOM-free, so the rules are
// unit-tested independently of the store/UI.

// The picker's full set, in menu order: "no_status" (the default — see below), then the
// New → In Progress → In Review → Done practice-prep workflow, then Archived (a parked Lesson) and
// Template (the side state that turns a Lesson into a reusable starting point).
export const LESSON_STATUSES = [
  "no_status",
  "new",
  "in_progress",
  "in_review",
  "done",
  "archived",
  "template",
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

// "no_status" is the UI sentinel for an absent field — a Lesson with no stored status reads as
// "No Status", and choosing "No Status" clears the field rather than storing a value. So it's the
// default but never persisted; only these six are ever written to a record.
export const DEFAULT_STATUS: LessonStatus = "no_status";
const STORABLE: readonly LessonStatus[] = [
  "new",
  "in_progress",
  "in_review",
  "done",
  "archived",
  "template",
];

// Coerce untrusted input to a stored status, or undefined to leave the field absent (= "No
// Status"). Runs on persisted + imported data, so a hand-edited / hostile value — or the
// "no_status" sentinel — can't carry an unknown/sentinel status into a record.
export function normalizeStatus(raw: unknown): LessonStatus | undefined {
  return typeof raw === "string" && STORABLE.includes(raw as LessonStatus)
    ? (raw as LessonStatus)
    : undefined;
}

// The effective status to display and act on: the stored one, or "No Status" when absent.
export function effectiveStatus(lesson: { status?: LessonStatus }): LessonStatus {
  return lesson.status ?? DEFAULT_STATUS;
}

// Normalize a Lesson's status in place if present; a no-op when absent (a plain "new" lesson).
export function normalizeLessonStatus(lesson: { status?: LessonStatus }): void {
  if (lesson.status !== undefined) lesson.status = normalizeStatus(lesson.status);
}

// Is this Lesson usable as a template? (Drives the "new from template" affordance in the Library.)
export const isTemplate = (lesson: { status?: LessonStatus }): boolean =>
  lesson.status === "template";
