import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/render.tsx";
import ImageCell from "./ImageCell.tsx";
import { newImageCell } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

describe("ImageCell (view)", () => {
  it("shows an empty state when not editing and there is no image", () => {
    renderWithProviders(<ImageCell cell={newImageCell()} editing={false} />);
    expect(screen.getByText("No image — click to add one.")).toBeTruthy();
  });

  it("offers an add affordance when editing an empty cell", () => {
    const { container } = renderWithProviders(<ImageCell cell={newImageCell()} editing={true} />);
    expect(screen.getByText("Add an image")).toBeTruthy(); // t("image.addTitle")
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });
});
