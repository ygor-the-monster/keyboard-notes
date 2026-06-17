import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  loadState,
  saveState,
  flushState,
  requestPersistentStorage,
  uid,
  newNotebook,
  newMarkdownCell,
  newMusicCell,
  newImageCell,
  newPdfCell,
  newAudioCell,
  newCifraCell,
} from "./StoreProvider.utils.js";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState({ notebooks: {}, order: [], activeId: null });
  const [hydrated, setHydrated] = useState(false);

  // IndexedDB reads are async, so load after mount (rather than in a useState initializer).
  // A default lesson is created only if there's genuinely nothing stored.
  useEffect(() => {
    let active = true;
    (async () => {
      let s = await loadState();
      if (!s.activeId && s.order.length === 0) {
        const nb = newNotebook();
        s = { notebooks: { [nb.id]: nb }, order: [nb.id], activeId: nb.id };
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
  const commit = useCallback((mutate) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      saveState(draft);
      return draft;
    });
  }, []);

  // Latest state, readable synchronously inside actions (the setState updater runs later).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Last deleted cell, held off to the side for a transient Undo (not persisted).
  const [lastDeleted, setLastDeletedState] = useState(null);
  const lastDeletedRef = useRef(null);
  const setLastDeleted = useCallback((v) => {
    lastDeletedRef.current = v;
    setLastDeletedState(v);
  }, []);

  const activeNotebook = state.activeId ? state.notebooks[state.activeId] : null;

  const api = useMemo(() => {
    const touch = (draft) => {
      const nb = draft.notebooks[draft.activeId];
      if (nb) nb.updated = Date.now();
    };
    return {
      createNotebook() {
        commit((d) => {
          const nb = newNotebook();
          d.notebooks[nb.id] = nb;
          d.order.unshift(nb.id);
          d.activeId = nb.id;
        });
      },
      selectNotebook(id) {
        commit((d) => {
          d.activeId = id;
        });
      },
      deleteNotebook(id) {
        commit((d) => {
          delete d.notebooks[id];
          d.order = d.order.filter((x) => x !== id);
          if (d.activeId === id) d.activeId = d.order[0] || null;
        });
      },
      setTitle(title) {
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (nb) {
            nb.title = title;
            nb.updated = Date.now();
          }
        });
      },
      addCell(type) {
        const cell =
          type === "abc"
            ? newMusicCell()
            : type === "cifra"
              ? newCifraCell()
              : type === "img"
                ? newImageCell()
                : type === "pdf"
                  ? newPdfCell()
                  : type === "snd"
                    ? newAudioCell()
                    : newMarkdownCell();
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          nb.cells.push(cell);
          touch(d);
        });
        return cell.id;
      },
      updateCell(cellId, patch) {
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          const c = nb.cells.find((x) => x.id === cellId);
          if (c) Object.assign(c, patch);
          touch(d);
        });
      },
      moveCell(cellId, dir) {
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          const i = nb.cells.findIndex((x) => x.id === cellId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= nb.cells.length) return;
          const [c] = nb.cells.splice(i, 1);
          nb.cells.splice(j, 0, c);
          touch(d);
        });
      },
      // Move a cell to an absolute index (used by drag-to-reorder).
      moveCellTo(cellId, toIndex) {
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          const i = nb.cells.findIndex((x) => x.id === cellId);
          if (i < 0) return;
          const j = Math.max(0, Math.min(toIndex, nb.cells.length - 1));
          if (j === i) return;
          const [c] = nb.cells.splice(i, 1);
          nb.cells.splice(j, 0, c);
          touch(d);
        });
      },
      duplicateCell(cellId) {
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          const i = nb.cells.findIndex((x) => x.id === cellId);
          if (i < 0) return;
          const copy = structuredClone(nb.cells[i]);
          copy.id = uid();
          nb.cells.splice(i + 1, 0, copy);
          touch(d);
        });
      },
      deleteCell(cellId) {
        // Stash the cell + its position so the delete can be undone (transient, not saved).
        const st = stateRef.current;
        const nb0 = st.notebooks[st.activeId];
        const idx = nb0 ? nb0.cells.findIndex((x) => x.id === cellId) : -1;
        if (idx >= 0) {
          setLastDeleted({
            notebookId: st.activeId,
            index: idx,
            cell: structuredClone(nb0.cells[idx]),
          });
        }
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          nb.cells = nb.cells.filter((x) => x.id !== cellId);
          touch(d);
        });
      },
      undoDelete() {
        const ld = lastDeletedRef.current;
        if (!ld) return;
        commit((d) => {
          const nb = d.notebooks[ld.notebookId];
          if (!nb) return;
          nb.cells.splice(Math.min(ld.index, nb.cells.length), 0, ld.cell);
          nb.updated = Date.now();
          d.activeId = ld.notebookId;
        });
        setLastDeleted(null);
      },
      dismissUndo() {
        setLastDeleted(null);
      },
      importNotebook(parsed) {
        commit((d) => {
          const nb = parsed.notebook || parsed;
          if (!nb || !nb.cells) throw new Error("Not a Piano Notes file");
          nb.id = uid();
          nb.updated = Date.now();
          if (!nb.created) nb.created = Date.now();
          d.notebooks[nb.id] = nb;
          d.order.unshift(nb.id);
          d.activeId = nb.id;
        });
      },
      // Restore a full-library backup: every notebook is added with a fresh id (so it never
      // clobbers existing lessons).
      importLibrary(parsed) {
        commit((d) => {
          const lib = parsed.library || parsed;
          const nbs = lib.notebooks;
          if (!nbs || typeof nbs !== "object") throw new Error("Not a Piano Notes backup");
          const order =
            Array.isArray(lib.order) && lib.order.length
              ? lib.order.filter((id) => nbs[id])
              : Object.keys(nbs);
          let firstNew = null;
          for (const oldId of order) {
            const nb = structuredClone(nbs[oldId]);
            nb.id = uid();
            if (!nb.created) nb.created = Date.now();
            nb.updated = Date.now();
            d.notebooks[nb.id] = nb;
            d.order.push(nb.id);
            if (!firstNew) firstNew = nb.id;
          }
          if (firstNew) d.activeId = firstNew;
        });
      },
    };
  }, [commit, setLastDeleted]);

  const value = useMemo(
    () => ({ state, activeNotebook, hydrated, lastDeleted, ...api }),
    [state, activeNotebook, hydrated, lastDeleted, api],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
