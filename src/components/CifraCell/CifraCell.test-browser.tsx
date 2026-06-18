import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { StoreProvider } from "../../providers/StoreProvider/StoreProvider.tsx";
import { I18nProvider } from "../../providers/I18nProvider/I18nProvider.tsx";
import CifraCell from "./CifraCell.tsx";
import type { CellOf } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

const cifra = (source: string, transpose = 0): CellOf<"cifra"> => ({
  id: "c1",
  kind: "cifra",
  source,
  transpose,
});

const renderCifra = (cell: CellOf<"cifra">) =>
  render(
    <StoreProvider>
      <I18nProvider>
        <CifraCell cell={cell} editing={false} />
      </I18nProvider>
    </StoreProvider>,
  );

describe("CifraCell (rendered chart)", () => {
  it("lays out chords above their lyrics", () => {
    const { container } = renderCifra(cifra("[C]Twinkle [G]twinkle"));
    const text = container.textContent ?? "";
    expect(text).toContain("Twinkle");
    expect(text).toContain("C");
    expect(text).toContain("G");
  });

  it("transposes the rendered chords by the cell's semitone offset", () => {
    // +2 semitones turns C→D and G→A in the rendered chart, without touching the source.
    const { container } = renderCifra(cifra("[C]Hi [G]there", 2));
    const text = container.textContent ?? "";
    expect(text).toContain("D");
    expect(text).toContain("A");
    expect(text).toContain("Hi");
  });
});
