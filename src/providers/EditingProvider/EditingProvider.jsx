import { createContext, useCallback, useContext, useState } from "react";

// Which cell is currently being edited (Jupyter-style active cell). Click into a cell to
// edit; click away to render. Only one at a time.
const EditingContext = createContext({ editingId: null, setEditing: () => {} });

export function EditingProvider({ children }) {
  const [editingId, setEditingId] = useState(null);
  const setEditing = useCallback((id) => setEditingId(id), []);
  return (
    <EditingContext.Provider value={{ editingId, setEditing }}>{children}</EditingContext.Provider>
  );
}

export const useEditing = () => useContext(EditingContext);
