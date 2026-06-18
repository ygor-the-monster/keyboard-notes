import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface EditingValue {
  editingId: string | null;
  setEditing: (id: string | null) => void;
}

// Which cell is currently being edited (Jupyter-style active cell). Click into a cell to
// edit; click away to render. Only one at a time.
const EditingContext = createContext<EditingValue | null>(null);

export function EditingProvider({ children }: { children: ReactNode }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const setEditing = useCallback((id: string | null) => setEditingId(id), []);
  return (
    <EditingContext.Provider value={{ editingId, setEditing }}>{children}</EditingContext.Provider>
  );
}

export function useEditing(): EditingValue {
  const ctx = useContext(EditingContext);
  if (!ctx) throw new Error("useEditing must be used within EditingProvider");
  return ctx;
}
