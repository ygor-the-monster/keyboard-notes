import { describe, it, expect, vi } from "vitest";
import { buildScoreTools } from "./ScoreCell.tools.ts";
import type { GroupTool, SpinnerTool, ToggleTool } from "../Toolbar/Toolbar.tsx";

const t = (k: string) => k;
const noop = () => {};

function build(over: Partial<Parameters<typeof buildScoreTools>[0]> = {}) {
  return buildScoreTools({
    t,
    ins: noop,
    smart: noop,
    wrapSel: noop,
    insLine: noop,
    applyScore: noop,
    headerNow: () => "",
    bodyNow: () => "",
    playing: false,
    play: noop,
    stop: noop,
    tempoNow: () => 120,
    setTempo: noop,
    ...over,
  });
}
const find = (tools: ReturnType<typeof build>, id: string) =>
  tools.find((x) => x.kind !== "sep" && x.id === id);

describe("buildScoreTools", () => {
  it("reflects playing on the play toggle and routes the toggle to play/stop", () => {
    const play = vi.fn(),
      stop = vi.fn();
    const playTool = find(build({ playing: true, play, stop }), "play") as ToggleTool;
    expect(playTool.value).toBe(true);
    playTool.onToggle();
    expect(stop).toHaveBeenCalled();
    const playTool2 = find(build({ playing: false, play, stop }), "play") as ToggleTool;
    expect(playTool2.value).toBe(false);
    playTool2.onToggle();
    expect(play).toHaveBeenCalled();
  });

  it("disables tempo − at 40 BPM and tempo + at 220 BPM", () => {
    expect((find(build({ tempoNow: () => 40 }), "tempo") as SpinnerTool).prevDisabled).toBe(true);
    expect((find(build({ tempoNow: () => 220 }), "tempo") as SpinnerTool).nextDisabled).toBe(true);
    const mid = find(build({ tempoNow: () => 120 }), "tempo") as SpinnerTool;
    expect(mid.prevDisabled).toBe(false);
    expect(mid.nextDisabled).toBe(false);
  });

  it("offers the seven note letters plus the octave-up c, each inserting its letter", () => {
    const ins = vi.fn();
    const notes = find(build({ ins }), "notes") as GroupTool;
    expect(notes.options.map((o) => o.id)).toEqual(["C", "D", "E", "F", "G", "A", "B", "c"]);
    notes.options[0].onUse?.();
    expect(ins).toHaveBeenCalledWith("C");
  });

  it("builds 10 clef options and 10 add-staff options from the shared clef list", () => {
    const tools = build();
    expect((find(tools, "clef") as GroupTool).options).toHaveLength(10);
    expect((find(tools, "addstaff") as GroupTool).options).toHaveLength(10);
  });

  it("wires decorations to !name! inserts", () => {
    const ins = vi.fn();
    const orn = find(build({ ins }), "orn") as GroupTool;
    orn.options[0].onUse?.(); // staccato
    expect(ins).toHaveBeenCalledWith("!staccato!");
  });
});
