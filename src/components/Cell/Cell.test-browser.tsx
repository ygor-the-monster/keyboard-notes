import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../test/render.tsx";
import Cell from "./Cell.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

const note = (source: string): CellOf<"note"> => ({ id: "n1", kind: "note", source });
const cifra = (source: string): CellOf<"cifra"> => ({
  id: "c1",
  kind: "cifra",
  source,
  transpose: 0,
});

describe("Cell (dispatch + chrome)", () => {
  it("dispatches a note cell to its Markdown body and shows the kind tag + drag handle", () => {
    const { container } = renderWithProviders(<Cell cell={note("**bold**")} />);
    expect(container.querySelector(".md-preview strong")?.textContent).toBe("bold");
    expect(screen.getByText("Note")).toBeTruthy(); // t("cell.note")
    expect(container.querySelector('[aria-label="Drag to reorder"]')).not.toBeNull();
  });

  it("dispatches a cifra cell to the chord chart instead", () => {
    const { container } = renderWithProviders(<Cell cell={cifra("[C]Hi")} />);
    expect(container.textContent ?? "").toContain("Hi");
    expect(screen.getByText("Chords")).toBeTruthy(); // t("cell.cifra")
  });

  it("deletes on tap without a confirmation dialog (recoverable via the undo toast)", () => {
    const { container } = renderWithProviders(<Cell cell={note("x")} />);
    const del = container.querySelector<HTMLElement>('[aria-label="Delete cell"]');
    expect(del).not.toBeNull();
    fireEvent.click(del!);
    // No confirmation gate — deletion fires immediately; undo is offered via a toast instead.
    expect(screen.queryByText("Delete this cell?")).toBeNull();
  });
});
