import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { EditingProvider, useEditing } from "./EditingProvider.tsx";

const wrapper = ({ children }: { children: ReactNode }) => (
  <EditingProvider>{children}</EditingProvider>
);

describe("useEditing", () => {
  it("starts with no cell being edited", () => {
    const { result } = renderHook(() => useEditing(), { wrapper });
    expect(result.current.editingId).toBeNull();
  });

  it("setEditing selects, then clears, the active cell (only one at a time)", () => {
    const { result } = renderHook(() => useEditing(), { wrapper });
    act(() => result.current.setEditing("cell-1"));
    expect(result.current.editingId).toBe("cell-1");
    act(() => result.current.setEditing("cell-2"));
    expect(result.current.editingId).toBe("cell-2");
    act(() => result.current.setEditing(null));
    expect(result.current.editingId).toBeNull();
  });

  it("throws when used outside its provider", () => {
    expect(() => renderHook(() => useEditing())).toThrow(/EditingProvider/);
  });

  it("entering performance mode drops any active edit", () => {
    const { result } = renderHook(() => useEditing(), { wrapper });
    act(() => result.current.setEditing("cell-1"));
    act(() => result.current.setPerforming(true));
    expect(result.current.performing).toBe(true);
    expect(result.current.editingId).toBeNull();
  });

  it("locks editing while performing — setEditing is a no-op until it exits", () => {
    const { result } = renderHook(() => useEditing(), { wrapper });
    act(() => result.current.setPerforming(true));
    act(() => result.current.setEditing("cell-1"));
    expect(result.current.editingId).toBeNull(); // locked
    act(() => result.current.setPerforming(false));
    act(() => result.current.setEditing("cell-1"));
    expect(result.current.editingId).toBe("cell-1"); // editable again
  });
});
