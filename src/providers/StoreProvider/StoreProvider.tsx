import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  loadState,
  saveState,
  flushState,
  requestPersistentStorage,
} from "./StoreProvider.utils.ts";
import { uid } from "../../utils/cellId/cellId.ts";
import { cellKinds, defaultLesson } from "../../utils/cellKinds/cellKinds.ts";
import type { AppState, Cell, Kind, Lesson } from "../../utils/cellKinds/cellKinds.ts";

interface LastDeleted {
  lessonId: string;
  index: number;
  cell: Cell;
}

interface StoreApi {
  createLesson(): void;
  selectLesson(id: string): void;
  deleteLesson(id: string): void;
  setTitle(title: string): void;
  addCell(kind: Kind): string;
  updateCell(cellId: string, patch: Partial<Cell>): void;
  moveCell(cellId: string, dir: number): void;
  moveCellTo(cellId: string, toIndex: number): void;
  duplicateCell(cellId: string): void;
  deleteCell(cellId: string): void;
  undoDelete(): void;
  dismissUndo(): void;
  importLesson(parsed: unknown): void;
  importLibrary(parsed: unknown): void;
}

export interface StoreValue extends StoreApi {
  state: AppState;
  activeLesson: Lesson | null;
  hydrated: boolean;
  lastDeleted: LastDeleted | null;
}

const StoreContext = createContext<StoreValue | null>(null);

// The Lesson under d.activeId, or undefined — most mutations operate on it.
const activeLessonOf = (d: AppState): Lesson | undefined =>
  d.activeId ? d.lessons[d.activeId] : undefined;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({ lessons: {}, order: [], activeId: null });
  const [hydrated, setHydrated] = useState(false);

  // IndexedDB reads are async, so load after mount (rather than in a useState initializer).
  // An empty default Lesson is created only if there's genuinely nothing stored.
  useEffect(() => {
    let active = true;
    (async () => {
      let s = await loadState();
      if (!s.activeId && s.order.length === 0) {
        const lesson = defaultLesson();
        s = { lessons: { [lesson.id]: lesson }, order: [lesson.id], activeId: lesson.id };
        saveState(s);
      }
      if (active) {
        setState(s);
        setHydrated(true);
      }
      requestPersistentStorage(); // make IndexedDB durable (best-effort)
    })();
    return () => {
      active = false;
    };
  }, []);

  // Flush the debounced save the moment the tab is hidden/closed, so the last edit lands.
  useEffect(() => {
    const onHide = () => flushState();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // commit a mutator that receives a *draft* clone and returns nothing
  const commit = useCallback((mutate: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      saveState(draft);
      return draft;
    });
  }, []);

  // Latest state, readable synchronously inside actions (the setState updater runs later).
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  // Last deleted cell, held off to the side for a transient Undo (not persisted).
  const [lastDeleted, setLastDeletedState] = useState<LastDeleted | null>(null);
  const lastDeletedRef = useRef<LastDeleted | null>(null);
  const setLastDeleted = useCallback((v: LastDeleted | null) => {
    lastDeletedRef.current = v;
    setLastDeletedState(v);
  }, []);

  const activeLesson = state.activeId ? (state.lessons?.[state.activeId] ?? null) : null;

  const api = useMemo<StoreApi>(() => {
    const touch = (draft: AppState) => {
      const lesson = activeLessonOf(draft);
      if (lesson) lesson.updated = Date.now();
    };
    return {
      createLesson() {
        commit((d) => {
          const lesson = defaultLesson();
          d.lessons[lesson.id] = lesson;
          d.order.unshift(lesson.id);
          d.activeId = lesson.id;
        });
      },
      selectLesson(id) {
        commit((d) => {
          d.activeId = id;
        });
      },
      deleteLesson(id) {
        commit((d) => {
          delete d.lessons[id];
          d.order = d.order.filter((x) => x !== id);
          if (d.activeId === id) d.activeId = d.order[0] || null;
        });
      },
      setTitle(title) {
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (lesson) {
            lesson.title = title;
            lesson.updated = Date.now();
          }
        });
      },
      addCell(kind) {
        const cell = cellKinds[kind].factory();
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          lesson.cells.push(cell);
          touch(d);
        });
        return cell.id;
      },
      updateCell(cellId, patch) {
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          const c = lesson.cells.find((x) => x.id === cellId);
          if (c) Object.assign(c, patch);
          touch(d);
        });
      },
      moveCell(cellId, dir) {
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          const i = lesson.cells.findIndex((x) => x.id === cellId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= lesson.cells.length) return;
          const [c] = lesson.cells.splice(i, 1);
          lesson.cells.splice(j, 0, c);
          touch(d);
        });
      },
      // Move a cell to an absolute index (used by drag-to-reorder).
      moveCellTo(cellId, toIndex) {
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          const i = lesson.cells.findIndex((x) => x.id === cellId);
          if (i < 0) return;
          const j = Math.max(0, Math.min(toIndex, lesson.cells.length - 1));
          if (j === i) return;
          const [c] = lesson.cells.splice(i, 1);
          lesson.cells.splice(j, 0, c);
          touch(d);
        });
      },
      duplicateCell(cellId) {
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          const i = lesson.cells.findIndex((x) => x.id === cellId);
          if (i < 0) return;
          const copy = structuredClone(lesson.cells[i]);
          copy.id = uid();
          lesson.cells.splice(i + 1, 0, copy);
          touch(d);
        });
      },
      deleteCell(cellId) {
        // Stash the cell + its position so the delete can be undone (transient, not saved).
        const lesson0 = activeLessonOf(stateRef.current);
        const idx = lesson0 ? lesson0.cells.findIndex((x) => x.id === cellId) : -1;
        if (lesson0 && idx >= 0) {
          setLastDeleted({
            lessonId: lesson0.id,
            index: idx,
            cell: structuredClone(lesson0.cells[idx]),
          });
        }
        commit((d) => {
          const lesson = activeLessonOf(d);
          if (!lesson) return;
          lesson.cells = lesson.cells.filter((x) => x.id !== cellId);
          touch(d);
        });
      },
      undoDelete() {
        const ld = lastDeletedRef.current;
        if (!ld) return;
        commit((d) => {
          const lesson = d.lessons[ld.lessonId];
          if (!lesson) return;
          lesson.cells.splice(Math.min(ld.index, lesson.cells.length), 0, ld.cell);
          lesson.updated = Date.now();
          d.activeId = ld.lessonId;
        });
        setLastDeleted(null);
      },
      dismissUndo() {
        setLastDeleted(null);
      },
      importLesson(parsed) {
        commit((d) => {
          const p = parsed as { lesson?: Lesson } & Partial<Lesson>;
          const lesson = (p.lesson || p) as Lesson;
          if (!lesson || !lesson.cells) throw new Error("Not a Piano Notes file");
          lesson.id = uid();
          lesson.updated = Date.now();
          if (!lesson.created) lesson.created = Date.now();
          d.lessons[lesson.id] = lesson;
          d.order.unshift(lesson.id);
          d.activeId = lesson.id;
        });
      },
      // Restore a full-library backup: every Lesson is added with a fresh id (so it never
      // clobbers existing Lessons).
      importLibrary(parsed) {
        commit((d) => {
          const p = parsed as {
            library?: { lessons?: Record<string, Lesson>; order?: string[] };
          } & {
            lessons?: Record<string, Lesson>;
            order?: string[];
          };
          const lib = p.library || p;
          const lessons = lib.lessons;
          if (!lessons || typeof lessons !== "object") throw new Error("Not a Piano Notes backup");
          const order =
            Array.isArray(lib.order) && lib.order.length
              ? lib.order.filter((id) => lessons[id])
              : Object.keys(lessons);
          let firstNew: string | null = null;
          for (const oldId of order) {
            const lesson = structuredClone(lessons[oldId]);
            lesson.id = uid();
            if (!lesson.created) lesson.created = Date.now();
            lesson.updated = Date.now();
            d.lessons[lesson.id] = lesson;
            d.order.push(lesson.id);
            if (!firstNew) firstNew = lesson.id;
          }
          if (firstNew) d.activeId = firstNew;
        });
      },
    };
  }, [commit, setLastDeleted]);

  const value = useMemo<StoreValue>(
    () => ({ state, activeLesson, hydrated, lastDeleted, ...api }),
    [state, activeLesson, hydrated, lastDeleted, api],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
