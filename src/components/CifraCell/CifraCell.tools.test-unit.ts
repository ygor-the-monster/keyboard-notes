import { describe, it, expect, vi } from "vitest";
import { buildCifraTools } from "./CifraCell.tools.ts";
import type { Tool } from "../Toolbar/Toolbar.tsx";

const t = (k: string) => k;
// Shared assistant args (the editor passes a source getter + applier); irrelevant to these tests.
const extra = { sourceNow: () => "", applySource: () => {} };
const spinnerOf = (tools: Tool[]) => tools.find((x) => "id" in x && x.id === "transpose");

describe("buildCifraTools", () => {
  it("ends with the assistant tool", () => {
    const tools = buildCifraTools({
      t,
      transpose: 0,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const last = tools[tools.length - 1];
    expect("id" in last && last.id).toBe("assistant");
    expect(last.kind).toBe("input");
  });

  it("includes the transpose spinner", () => {
    const tools = buildCifraTools({
      t,
      transpose: 0,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const spinner = spinnerOf(tools);
    expect(spinner?.kind).toBe("spinner");
  });

  it("disables prev at the bottom of the range", () => {
    const tools = buildCifraTools({
      t,
      transpose: -11,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const spinner = spinnerOf(tools);
    expect(spinner?.kind === "spinner" && spinner.prevDisabled).toBe(true);
    expect(spinner?.kind === "spinner" && spinner.nextDisabled).toBe(false);
  });

  it("disables next at the top of the range", () => {
    const tools = buildCifraTools({
      t,
      transpose: 11,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const spinner = spinnerOf(tools);
    expect(spinner?.kind === "spinner" && spinner.nextDisabled).toBe(true);
    expect(spinner?.kind === "spinner" && spinner.prevDisabled).toBe(false);
  });

  it("includes the reset action when transposed", () => {
    const tools = buildCifraTools({
      t,
      transpose: 5,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const reset = tools.find((tool) => "id" in tool && tool.id === "reset");
    expect(reset).toBeDefined();
    expect(reset?.kind).toBe("action");
  });

  it("omits the reset action at zero transpose", () => {
    const tools = buildCifraTools({
      t,
      transpose: 0,
      setTranspose: vi.fn(),
      scrollTools: [],
      ...extra,
    });
    const reset = tools.find((tool) => "id" in tool && tool.id === "reset");
    expect(reset).toBeUndefined();
  });

  it("appends the supplied scrollTools just before the trailing assistant", () => {
    const scrollTools: Tool[] = [
      { kind: "action", id: "scroll-a", label: "a", onUse: vi.fn() },
      { kind: "action", id: "scroll-b", label: "b", onUse: vi.fn() },
    ];
    const tools = buildCifraTools({
      t,
      transpose: 0,
      setTranspose: vi.fn(),
      scrollTools,
      ...extra,
    });
    // ...scrollTools, { kind: "sep" }, assistant — so they sit two slots from the end.
    expect(tools.slice(-4, -2)).toEqual(scrollTools);
  });
});
