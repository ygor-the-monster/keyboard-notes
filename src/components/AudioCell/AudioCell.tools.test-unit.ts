import { describe, it, expect, vi } from "vitest";
import { buildAudioTools } from "./AudioCell.tools.ts";
import type { Tool, ToggleTool, SpinnerTool, ActionTool } from "../Toolbar/Toolbar.tsx";

type Sel = { start: number; end: number };

const t = (k: string) => k;

function build(over: Partial<Parameters<typeof buildAudioTools>[0]> = {}) {
  return buildAudioTools({
    t,
    playing: false,
    togglePlay: vi.fn(),
    rate: 1,
    changeRate: vi.fn(),
    sel: null,
    addMark: vi.fn(),
    recording: false,
    toggleRec: vi.fn(),
    trimToSel: vi.fn(),
    deleteSel: vi.fn(),
    openReplace: vi.fn(),
    undo: vi.fn(),
    ...over,
  });
}

const byId = (tools: Tool[], id: string) =>
  tools.find((tool) => tool.kind !== "sep" && tool.id === id)!;

describe("buildAudioTools", () => {
  it("play toggle value reflects `playing`", () => {
    expect((byId(build({ playing: false }), "play") as ToggleTool).value).toBe(false);
    expect((byId(build({ playing: true }), "play") as ToggleTool).value).toBe(true);
  });

  it("speed spinner prevDisabled at rate=0.5 and nextDisabled at rate=1.5", () => {
    const lo = byId(build({ rate: 0.5 }), "speed") as SpinnerTool;
    expect(lo.prevDisabled).toBe(true);
    expect(lo.nextDisabled).toBe(false);

    const hi = byId(build({ rate: 1.5 }), "speed") as SpinnerTool;
    expect(hi.nextDisabled).toBe(true);
    expect(hi.prevDisabled).toBe(false);
  });

  it("trim and delsel disabled when sel is null", () => {
    const tools = build({ sel: null });
    expect((byId(tools, "trim") as ActionTool).disabled).toBe(true);
    expect((byId(tools, "delsel") as ActionTool).disabled).toBe(true);
  });

  it("trim and delsel enabled when sel is an object", () => {
    const sel: Sel = { start: 1, end: 2 };
    const tools = build({ sel });
    expect((byId(tools, "trim") as ActionTool).disabled).toBe(false);
    expect((byId(tools, "delsel") as ActionTool).disabled).toBe(false);
  });

  it("rec label reflects selection state", () => {
    const withSel = byId(build({ sel: { start: 1, end: 2 } }), "rec") as ToggleTool;
    expect(withSel.label).toBe("audio.recordSelection");

    const noSel = byId(build({ sel: null }), "rec") as ToggleTool;
    expect(noSel.label).toBe("audio.recordCursor");
  });
});
