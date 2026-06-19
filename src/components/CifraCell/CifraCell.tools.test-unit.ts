import { describe, it, expect, vi } from "vitest";
import { buildCifraTools } from "./CifraCell.tools.ts";
import type { Tool } from "../Toolbar/Toolbar.tsx";

const t = (k: string) => k;

describe("buildCifraTools", () => {
  it("starts with the transpose spinner", () => {
    const tools = buildCifraTools({ t, transpose: 0, setTranspose: vi.fn(), scrollTools: [] });
    const spinner = tools[0];
    expect(spinner.kind).toBe("spinner");
    expect("id" in spinner && spinner.id).toBe("transpose");
  });

  it("disables prev at the bottom of the range", () => {
    const tools = buildCifraTools({ t, transpose: -11, setTranspose: vi.fn(), scrollTools: [] });
    const spinner = tools[0];
    expect(spinner.kind === "spinner" && spinner.prevDisabled).toBe(true);
    expect(spinner.kind === "spinner" && spinner.nextDisabled).toBe(false);
  });

  it("disables next at the top of the range", () => {
    const tools = buildCifraTools({ t, transpose: 11, setTranspose: vi.fn(), scrollTools: [] });
    const spinner = tools[0];
    expect(spinner.kind === "spinner" && spinner.nextDisabled).toBe(true);
    expect(spinner.kind === "spinner" && spinner.prevDisabled).toBe(false);
  });

  it("includes the reset action when transposed", () => {
    const tools = buildCifraTools({ t, transpose: 5, setTranspose: vi.fn(), scrollTools: [] });
    const reset = tools.find((tool) => "id" in tool && tool.id === "reset");
    expect(reset).toBeDefined();
    expect(reset?.kind).toBe("action");
  });

  it("omits the reset action at zero transpose", () => {
    const tools = buildCifraTools({ t, transpose: 0, setTranspose: vi.fn(), scrollTools: [] });
    const reset = tools.find((tool) => "id" in tool && tool.id === "reset");
    expect(reset).toBeUndefined();
  });

  it("appends the supplied scrollTools at the end", () => {
    const scrollTools: Tool[] = [
      { kind: "action", id: "scroll-a", label: "a", onUse: vi.fn() },
      { kind: "action", id: "scroll-b", label: "b", onUse: vi.fn() },
    ];
    const tools = buildCifraTools({ t, transpose: 0, setTranspose: vi.fn(), scrollTools });
    expect(tools.slice(-2)).toEqual(scrollTools);
  });
});
