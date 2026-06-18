import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/render.tsx";
import ScoreCell from "./ScoreCell.tsx";
import { newScoreCell } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

describe("ScoreCell (view)", () => {
  it("shows an empty state when not editing and there is no music", () => {
    renderWithProviders(<ScoreCell cell={newScoreCell()} editing={false} />);
    expect(screen.getByText("Empty score — click to write notes")).toBeTruthy();
  });

  it("renders the ABC header + body editors when editing", () => {
    const { container } = renderWithProviders(<ScoreCell cell={newScoreCell()} editing={true} />);
    // Header + body textareas (native elements carry their aria-labels).
    expect(container.querySelector('textarea[aria-label="ABC header"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="ABC music"]')).not.toBeNull();
  });
});
