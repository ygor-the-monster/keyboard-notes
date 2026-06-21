import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import CellErrorBoundary from "./CellErrorBoundary.tsx";

// A child that throws on demand, so we can drive the boundary into and out of its error state.
function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error("kaboom");
  return <div>cell body</div>;
}

const fallback = () => <div>fallback shown</div>;

// React logs caught render errors to console.error; silence it so the test output stays clean while
// still exercising the real boundary path.
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CellErrorBoundary", () => {
  it("renders children when nothing throws", () => {
    render(
      <CellErrorBoundary fallback={fallback}>
        <Boom explode={false} />
      </CellErrorBoundary>,
    );
    expect(screen.getByText("cell body")).toBeTruthy();
  });

  it("renders the fallback when a child throws", () => {
    render(
      <CellErrorBoundary fallback={fallback}>
        <Boom explode={true} />
      </CellErrorBoundary>,
    );
    expect(screen.getByText("fallback shown")).toBeTruthy();
    expect(screen.queryByText("cell body")).toBeNull();
  });

  it("retry from the fallback re-renders the body once the child stops throwing", () => {
    // First mount throws, then we flip the child to healthy and press retry.
    const { rerender } = render(
      <CellErrorBoundary fallback={(retry) => <button onClick={retry}>retry</button>}>
        <Boom explode={true} />
      </CellErrorBoundary>,
    );
    expect(screen.getByText("retry")).toBeTruthy();
    rerender(
      <CellErrorBoundary fallback={(retry) => <button onClick={retry}>retry</button>}>
        <Boom explode={false} />
      </CellErrorBoundary>,
    );
    fireEvent.click(screen.getByText("retry"));
    expect(screen.getByText("cell body")).toBeTruthy();
  });

  it("auto-recovers when resetKeys change (e.g. the cell data was fixed)", () => {
    const { rerender } = render(
      <CellErrorBoundary fallback={fallback} resetKeys={["v1"]}>
        <Boom explode={true} />
      </CellErrorBoundary>,
    );
    expect(screen.getByText("fallback shown")).toBeTruthy();
    // A new resetKey + a healthy child clears the held error with no manual retry.
    rerender(
      <CellErrorBoundary fallback={fallback} resetKeys={["v2"]}>
        <Boom explode={false} />
      </CellErrorBoundary>,
    );
    expect(screen.getByText("cell body")).toBeTruthy();
  });
});
