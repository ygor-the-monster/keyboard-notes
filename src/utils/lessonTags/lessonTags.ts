// The single place a Lesson's tags are normalized (ADR-0005). Applied by the store mutations, by
// normalizeState on load, and on import — so a tag set can't drift in casing, whitespace, order, or
// duplicates across those paths. Pure and DOM-free.

const MAX_TAG_LEN = 32; // a tag is a label, not a sentence — keeps chips readable
const MAX_TAGS = 24; // a sane ceiling per lesson; guards a corrupt/hostile import

// Lowercase, trim, collapse inner whitespace, drop empties, de-dupe, cap length + count, then sort
// so two lessons with the same tags compare/serialize identically. Non-array / non-string input is
// coerced away rather than throwing — this also runs on untrusted imported data.
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = item.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TAG_LEN).trim();
    if (tag) seen.add(tag);
  }
  return [...seen].sort().slice(0, MAX_TAGS);
}

// Normalize a Lesson's tags in place if present; a no-op when the field is absent (untagged lesson).
export function normalizeLessonTags(lesson: { tags?: string[] }): void {
  if (lesson.tags !== undefined) lesson.tags = normalizeTags(lesson.tags);
}
