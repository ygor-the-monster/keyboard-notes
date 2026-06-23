import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface EditingValue {
  editingId: string | null;
  setEditing: (id: string | null) => void;
  // Performance ("present") mode — a read-only lock for playing from the lesson at the piano. While
  // on, all chrome hides and no cell can be edited; entering it drops any active edit.
  performing: boolean;
  setPerforming: (on: boolean) => void;
}

// Which cell is currently being edited (Jupyter-style active cell). Click into a cell to
// edit; click away to render. Only one at a time.
const EditingContext = createContext<EditingValue | null>(null);

export function EditingProvider({ children }: { children: ReactNode }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [performing, setPerformingState] = useState(false);
  // Mirror `performing` into a ref so the stable `setEditing` callback can gate on it without being
  // re-created (its many subscribers would otherwise re-render on every mode change).
  const performingRef = useRef(false);

  // Edits are locked while performing — clicks into cells become no-ops, so the layout can't shift
  // while the user plays. The error-boundary "Edit source" escape hatch is the only caller that
  // would fire here in that state, and it's hidden with the rest of the chrome.
  const setEditing = useCallback((id: string | null) => {
    if (performingRef.current) return;
    setEditingId(id);
  }, []);

  const setPerforming = useCallback((on: boolean) => {
    performingRef.current = on;
    setPerformingState(on);
    if (on) setEditingId(null); // leave edit mode as we enter performance
  }, []);

  return (
    <EditingContext.Provider value={{ editingId, setEditing, performing, setPerforming }}>
      {children}
    </EditingContext.Provider>
  );
}

export function useEditing(): EditingValue {
  const ctx = useContext(EditingContext);
  if (!ctx) throw new Error("useEditing must be used within EditingProvider");
  return ctx;
}
