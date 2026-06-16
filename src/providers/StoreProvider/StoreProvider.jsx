import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  loadState,
  saveState,
  uid,
  newNotebook,
  newMarkdownCell,
  newMusicCell,
  newImageCell,
  newPdfCell,
  newAudioCell,
} from "./StoreProvider.utils.js";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => {
    const s = loadState();
    if (!s.activeId && s.order.length === 0) {
      const nb = newNotebook();
      s.notebooks[nb.id] = nb;
      s.order = [nb.id];
      s.activeId = nb.id;
    }
    return s;
  });

  // commit a mutator that receives a *draft* clone and returns nothing
  const commit = useCallback((mutate) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      saveState(draft);
      return draft;
    });
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
        commit((d) => {
          const nb = d.notebooks[d.activeId];
          if (!nb) return;
          nb.cells = nb.cells.filter((x) => x.id !== cellId);
          touch(d);
        });
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
    };
  }, [commit]);

  const value = useMemo(() => ({ state, activeNotebook, ...api }), [state, activeNotebook, api]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
