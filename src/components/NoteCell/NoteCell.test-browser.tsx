import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { StoreProvider } from "../../providers/StoreProvider/StoreProvider.tsx";
import { I18nProvider } from "../../providers/I18nProvider/I18nProvider.tsx";
import NoteCell from "./NoteCell.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

const note = (source: string): CellOf<"note"> => ({ id: "n1", kind: "note", source });

const renderNote = (cell: CellOf<"note">) =>
  render(
    <StoreProvider>
      <I18nProvider>
        <NoteCell cell={cell} editing={false} />
      </I18nProvider>
    </StoreProvider>,
  );

describe("NoteCell (rendered view)", () => {
  it("renders Markdown source to HTML in the preview", () => {
    const { container } = renderNote(note("**bold** and _em_"));
    const preview = container.querySelector(".md-preview");
    expect(preview).not.toBeNull();
    expect(preview?.querySelector("strong")?.textContent).toBe("bold");
    expect(preview?.querySelector("em")?.textContent).toBe("em");
  });

  it("wires up task-list checkboxes from the Markdown", () => {
    const { container } = renderNote(note("- [ ] practice scales\n- [x] warm up"));
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes.length).toBe(2);
    // The renderer enables them and reflects the checked state from the source.
    expect(boxes[0].disabled).toBe(false);
    expect(boxes[1].checked).toBe(true);
  });
});
