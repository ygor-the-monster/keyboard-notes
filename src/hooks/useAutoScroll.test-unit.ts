import { describe, it, expect } from "vitest";
import { buildScrollTools } from "./useAutoScroll.ts";

describe("buildScrollTools", () => {
  it("builds a play/pause toggle + a 1–5× speed spinner", () => {
    const noop = () => {};
    const tools = buildScrollTools({
      t: (k) => k,
      scrolling: false,
      toggle: noop,
      speed: 2,
      setSpeed: noop,
    });
    expect(tools.map((x) => x.kind)).toEqual(["toggle", "spinner"]);
    const spinner = tools[1];
    if (spinner.kind !== "spinner") throw new Error("expected a spinner");
    expect(spinner.display).toBe("2×");
    expect(spinner.prevDisabled).toBe(false);
  });
});
