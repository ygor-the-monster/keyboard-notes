import { describe, it, expect, afterEach } from "vitest";
import { useRef } from "react";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { useAutoScroll } from "./useAutoScroll.ts";

afterEach(cleanup);

// The hook scrolls the nearest `.app-scroll` ancestor via requestAnimationFrame — needs a real
// scrollable layout, so this runs in the browser. A tall inner block inside a short scroller makes
// the loop scroll for a while before its auto-stop condition trips.
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrolling, toggle } = useAutoScroll(ref);
  return (
    <div>
      <button onClick={toggle}>{scrolling ? "stop" : "start"}</button>
      <div
        className="app-scroll"
        data-testid="scroller"
        style={{ height: "200px", overflow: "auto" }}
      >
        <div ref={ref} style={{ height: "3000px" }}>
          content
        </div>
      </div>
    </div>
  );
}

describe("useAutoScroll (real layout)", () => {
  it("scrolls the container while running and stops when toggled off", async () => {
    render(<Harness />);
    const scroller = screen.getByTestId("scroller");
    expect(scroller.scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(scroller.scrollTop).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    const frozen = scroller.scrollTop;
    // After stopping, give the rAF loop a couple of frames to confirm it no longer advances.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    expect(scroller.scrollTop).toBe(frozen);
  });
});
