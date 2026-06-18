import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/render.tsx";
import AudioCell from "./AudioCell.tsx";
import { newAudioCell } from "../../utils/cellKinds/cellKinds.ts";

afterEach(cleanup);

describe("AudioCell (view)", () => {
  it("shows an empty state when not editing and there is no clip", () => {
    renderWithProviders(<AudioCell cell={newAudioCell()} editing={false} />);
    expect(screen.getByText("No audio — click to record or add one.")).toBeTruthy();
  });

  it("offers record + add affordances when editing an empty cell", () => {
    renderWithProviders(<AudioCell cell={newAudioCell()} editing={true} />);
    expect(screen.getByText("Record or add audio")).toBeTruthy(); // t("audio.addTitle")
    expect(screen.getByText("Record")).toBeTruthy(); // t("audio.record")
  });
});
