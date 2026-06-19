import { describe, it, expect, vi } from "vitest";
import { buildImageTools } from "./ImageCell.tools.ts";
import type { GroupOption, Tool } from "../Toolbar/Toolbar.tsx";

const t = (k: string) => k;
const transformOptions: GroupOption[] = [{ id: "rl", label: "rotateLeft" }];

// Sentinel so we can assert the annotation block's placement without coupling to its real shape.
const annotationTools: Tool[] = [{ kind: "sep" }];

function build(overrides: Partial<Parameters<typeof buildImageTools>[0]> = {}) {
  return buildImageTools({
    t,
    transformOptions,
    mode: "pen",
    toggleCrop: vi.fn(),
    adjust: vi.fn(),
    revert: vi.fn(),
    openReplace: vi.fn(),
    annotationTools,
    ...overrides,
  });
}

const idOf = (tool: Tool) => ("id" in tool ? tool.id : undefined);

describe("buildImageTools", () => {
  it("includes the transform group", () => {
    const tools = build();
    const transform = tools.find((x) => idOf(x) === "transform");
    expect(transform?.kind).toBe("group");
  });

  it("crop toggle value reflects mode", () => {
    const cropOf = (tools: Tool[]) => tools.find((x) => idOf(x) === "crop");

    const inCrop = cropOf(build({ mode: "crop" }));
    expect(inCrop?.kind).toBe("toggle");
    expect(inCrop && inCrop.kind === "toggle" && inCrop.value).toBe(true);

    const inPen = cropOf(build({ mode: "pen" }));
    expect(inPen && inPen.kind === "toggle" && inPen.value).toBe(false);
  });

  it("includes the bright, contrast and sat spinners", () => {
    const tools = build();
    for (const id of ["bright", "contrast", "sat"]) {
      const spinner = tools.find((x) => idOf(x) === id);
      expect(spinner?.kind).toBe("spinner");
    }
  });

  it("places annotation tools between the sat spinner and the replace action", () => {
    const tools = build();
    const satIdx = tools.findIndex((x) => idOf(x) === "sat");
    const replaceIdx = tools.findIndex((x) => idOf(x) === "replace");
    const annotIdx = tools.indexOf(annotationTools[0]);

    expect(satIdx).toBeGreaterThanOrEqual(0);
    expect(replaceIdx).toBeGreaterThan(satIdx);
    expect(annotIdx).toBeGreaterThan(satIdx);
    expect(annotIdx).toBeLessThan(replaceIdx);
  });

  it("includes the replace and revert actions", () => {
    const tools = build();
    const replace = tools.find((x) => idOf(x) === "replace");
    const revert = tools.find((x) => idOf(x) === "revert");
    expect(replace?.kind).toBe("action");
    expect(revert?.kind).toBe("action");
  });
});
