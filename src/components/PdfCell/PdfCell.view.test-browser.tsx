import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/render.tsx";
import PdfCell from "./PdfCell.tsx";
import { newPdfCell } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

// pdf.js only loads once there's a source, so an empty PdfCell renders without touching the worker.
describe("PdfCell (view)", () => {
  it("shows an empty state when not editing and there is no document", () => {
    renderWithProviders(<PdfCell cell={newPdfCell()} editing={false} />);
    expect(screen.getByText("No PDF — click to add one.")).toBeTruthy();
  });

  it("offers add affordances when editing an empty cell", () => {
    const { container } = renderWithProviders(<PdfCell cell={newPdfCell()} editing={true} />);
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });
});
