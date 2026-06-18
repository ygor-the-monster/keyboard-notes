import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { I18nProvider } from "../../providers/I18nProvider/I18nProvider.tsx";
import ChordBuilder from "./ChordBuilder.tsx";

afterEach(cleanup);

const renderBuilder = () =>
  render(
    <I18nProvider>
      <ChordBuilder />
    </I18nProvider>,
  );

// White keys render first (WHITE = [C, D, E, F, G, A, B]), so rect index 0/2/4 = C/E/G.
const whiteKey = (container: HTMLElement, i: number) =>
  container.querySelectorAll("rect")[i] as Element;

describe("ChordBuilder", () => {
  it("starts empty, prompting the user to tap keys", () => {
    renderBuilder();
    expect(screen.getByText("Tap keys to build a chord")).toBeTruthy();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("identifies a C major triad once C, E and G are tapped", () => {
    const { container } = renderBuilder();
    fireEvent.pointerDown(whiteKey(container, 0)); // C
    fireEvent.pointerDown(whiteKey(container, 2)); // E
    fireEvent.pointerDown(whiteKey(container, 4)); // G
    // The empty hint is replaced by the chord readout (which also appears in the tab badge).
    expect(screen.queryByText("Tap keys to build a chord")).toBeNull();
    expect(screen.getAllByText("C").length).toBeGreaterThanOrEqual(2);
  });

  it("clears the selection back to the empty state", () => {
    const { container } = renderBuilder();
    fireEvent.pointerDown(whiteKey(container, 0));
    fireEvent.pointerDown(whiteKey(container, 4));
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByText("Tap keys to build a chord")).toBeTruthy();
    expect(screen.queryByText("Clear")).toBeNull();
  });
});
