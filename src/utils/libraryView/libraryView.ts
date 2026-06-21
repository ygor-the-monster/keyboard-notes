// The pure heart of the Library screen (ADR-0005): given the store state and the user's
// search/sort/filter choices, produce the grouped, ordered view the screen renders. DOM-free and
// React-free, so all the browse logic is unit-tested independently of the component.
import type { AppState, Lesson } from "../cellKinds/cellKinds.ts";

export type LibrarySort = "recent" | "title" | "created";

export interface LibraryViewOptions {
  query: string; // free-text title filter
  sort: LibrarySort;
  activeTag: string | null; // single-tag filter (null = all)
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface LibraryView {
  pinned: Lesson[]; // pinned lessons matching the filters, in sort order
  rest: Lesson[]; // the remaining matching lessons, in sort order
  allTags: TagCount[]; // every tag across ALL lessons (not just filtered), with counts, for the chip row
  total: number; // count of lessons matching the filters (pinned + rest) — for the empty/no-match states
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function comparator(sort: LibrarySort): (a: Lesson, b: Lesson) => number {
  if (sort === "title")
    return (a, b) => collator.compare(a.title || "", b.title || "") || b.created - a.created;
  if (sort === "created") return (a, b) => b.created - a.created;
  return (a, b) => b.updated - a.updated; // "recent"
}

function matches(lesson: Lesson, q: string, activeTag: string | null): boolean {
  if (activeTag && !(lesson.tags ?? []).includes(activeTag)) return false;
  if (q && !(lesson.title || "").toLowerCase().includes(q)) return false;
  return true;
}

// The tag chip row reflects the whole Library (so a tag never vanishes just because the current
// search hides its only match) — counts are over all lessons, sorted by frequency then name.
function tagCounts(lessons: Lesson[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const l of lessons) for (const tag of l.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || collator.compare(a.tag, b.tag));
}

export function selectLibraryView(state: AppState, opts: LibraryViewOptions): LibraryView {
  const all = state.order.map((id) => state.lessons[id]).filter(Boolean);
  const q = opts.query.trim().toLowerCase();
  const cmp = comparator(opts.sort);

  const filtered = all.filter((l) => matches(l, q, opts.activeTag));
  const pinned = filtered.filter((l) => l.pinned).sort(cmp);
  const rest = filtered.filter((l) => !l.pinned).sort(cmp);

  return { pinned, rest, allTags: tagCounts(all), total: pinned.length + rest.length };
}
