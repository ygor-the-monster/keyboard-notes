import { describe, it, expect, vi } from "vitest";
import { buildPdfTools } from "./PdfCell.tools.ts";

const t = (k: string) => k;

function build(overrides: Partial<Parameters<typeof buildPdfTools>[0]> = {}) {
  return buildPdfTools({
    t,
    hasDoc: true,
    flow: "paged",
    setFlow: vi.fn(),
    view: "single",
    setView: vi.fn(),
    page: 1,
    numPages: 3,
    setPage: vi.fn(),
    annMode: false,
    setAnnMode: vi.fn(),
    rotatePage: vi.fn(),
    movePage: vi.fn(),
    duplicatePage: vi.fn(),
    removeCurrentPage: vi.fn(),
    openAppend: vi.fn(),
    openReplace: vi.fn(),
    scrollTools: [],
    annotationTools: [],
    ...overrides,
  });
}

const byId = (tools: ReturnType<typeof buildPdfTools>, id: string) =>
  tools.find((tool) => "id" in tool && tool.id === id);

describe("buildPdfTools", () => {
  it("includes the flow toggle", () => {
    const flow = byId(build(), "flow");
    expect(flow?.kind).toBe("toggle");
  });

  it("includes nav (page spinner + view toggle) when flow is paged", () => {
    const tools = build({ flow: "paged" });
    expect(byId(tools, "page")?.kind).toBe("spinner");
    expect(byId(tools, "view")?.kind).toBe("toggle");
  });

  it("omits nav when flow is all", () => {
    const tools = build({ flow: "all" });
    expect(byId(tools, "page")).toBeUndefined();
    expect(byId(tools, "view")).toBeUndefined();
  });

  it("includes the page tools when hasDoc is true", () => {
    const tools = build({ hasDoc: true });
    for (const id of ["rotate", "move", "dup", "append", "del"]) {
      expect(byId(tools, id)).toBeDefined();
    }
  });

  it("omits the page tools when hasDoc is false", () => {
    const tools = build({ hasDoc: false });
    for (const id of ["rotate", "move", "dup", "append", "del"]) {
      expect(byId(tools, id)).toBeUndefined();
    }
  });

  it("disables delete when there is only one page", () => {
    const del = byId(build({ numPages: 1 }), "del");
    expect(del?.kind === "action" && del.disabled).toBe(true);
  });

  it("enables delete when there are multiple pages", () => {
    const del = byId(build({ numPages: 3 }), "del");
    expect(del?.kind === "action" && del.disabled).toBe(false);
  });

  it("disables the page spinner's prev at the first page", () => {
    const page = byId(build({ page: 1, numPages: 3 }), "page");
    expect(page?.kind === "spinner" && page.prevDisabled).toBe(true);
    expect(page?.kind === "spinner" && page.nextDisabled).toBe(false);
  });

  it("disables the page spinner's next at the last page", () => {
    const page = byId(build({ page: 3, numPages: 3 }), "page");
    expect(page?.kind === "spinner" && page.nextDisabled).toBe(true);
    expect(page?.kind === "spinner" && page.prevDisabled).toBe(false);
  });

  it("reflects annMode in the annotate toggle value", () => {
    const off = byId(build({ annMode: false }), "annotate");
    expect(off?.kind === "toggle" && off.value).toBe(false);
    const on = byId(build({ annMode: true }), "annotate");
    expect(on?.kind === "toggle" && on.value).toBe(true);
  });
});
