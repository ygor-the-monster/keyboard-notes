// A within-session safety net for deletions. The 7-second undo toast is easy to miss (especially on
// a phone), so every deleted Lesson and Cell is also parked here — surfaced as a "Recently Deleted"
// section in the Library where it can be restored or purged.
//
// Backed by sessionStorage *by design*: it survives a reload but dies when the tab closes, and the
// buffer is capped (oldest evicted first, and again if a write hits the quota — a deleted media cell
// can be large). It is a convenience, not durable storage; the whole-library backup is the real net.
import type { DeletedCell, DeletedLesson } from "../../providers/StoreProvider/StoreProvider.tsx";

const KEY = "pianoNotes.recentlyDeleted";
const CAP = 20;

// One parked deletion. `id` is the underlying Lesson/Cell id (so re-deleting the same thing replaces
// its entry rather than piling up). `at` is the deletion time, for the relative-time label.
export type DeletedEntry =
  | { id: string; kind: "lesson"; at: number; title: string; payload: DeletedLesson }
  | {
      id: string;
      kind: "cell";
      at: number;
      cellKind: string;
      lessonTitle: string;
      payload: DeletedCell;
    };

function read(): DeletedEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DeletedEntry[]) : [];
  } catch (e) {
    console.warn("Recently Deleted read failed:", e);
    return [];
  }
}

// Persist the list, shedding the oldest entries until it fits the sessionStorage quota (a single
// large media cell can exceed what's left). Dropping the tail is acceptable — this is ephemeral.
function write(list: DeletedEntry[]): void {
  let next = list.slice(0, CAP);
  while (next.length) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
      return;
    } catch {
      next = next.slice(0, -1); // drop the oldest and retry
    }
  }
  try {
    sessionStorage.removeItem(KEY);
  } catch (e) {
    console.warn("Recently Deleted write failed:", e);
  }
}

// Park a deletion at the front of the list, replacing any prior entry for the same id.
export function pushDeleted(entry: DeletedEntry): void {
  write([entry, ...read().filter((e) => e.id !== entry.id)]);
}

export function listDeleted(): DeletedEntry[] {
  return read();
}

export function removeDeleted(id: string): void {
  write(read().filter((e) => e.id !== id));
}
