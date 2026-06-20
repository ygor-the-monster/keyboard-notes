import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useMetronome, type AccentLevel, type ToneSpec } from "./Metronome.hooks.ts";

// Real Web Audio: useMetronome drives a lookahead scheduler against the shared engine context.
// We assert the running lifecycle; cleanup() unmounts each hook so its scheduler interval is
// cleared between tests.
afterEach(cleanup);

const PATTERN: AccentLevel[] = [2, 1, 1, 1];
const SOUND: ToneSpec = {
  accent: { freq: 1600, type: "sine" },
  beat: { freq: 1000, type: "sine" },
};
const params = (bpm: number, beats: number, subdiv = 1, poly = 0) => ({
  bpm,
  beats,
  pattern: PATTERN,
  sound: SOUND,
  subdiv,
  poly,
});

describe("useMetronome (real Web Audio)", () => {
  it("starts stopped, with no current beat", () => {
    const { result } = renderHook(() => useMetronome(params(120, 4)));
    expect(result.current.running).toBe(false);
    expect(result.current.currentBeat).toBe(-1);
  });

  it("start() then stop() flips running and schedules clicks without throwing", () => {
    const { result } = renderHook(() => useMetronome(params(120, 4)));
    expect(() => act(() => result.current.start())).not.toThrow();
    expect(result.current.running).toBe(true);
    act(() => result.current.start()); // second start is a guarded no-op
    expect(result.current.running).toBe(true);
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    expect(result.current.currentBeat).toBe(-1);
  });

  it("toggle() alternates running state", () => {
    const { result } = renderHook(() => useMetronome(params(90, 3)));
    act(() => result.current.toggle());
    expect(result.current.running).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.running).toBe(false);
  });

  it("schedules subdivisions + a polyrhythm layer without throwing", () => {
    // 4 beats, sixteenth subdivisions, 3-against-4 polyrhythm.
    const { result } = renderHook(() => useMetronome(params(120, 4, 4, 3)));
    expect(() => act(() => result.current.start())).not.toThrow();
    expect(result.current.running).toBe(true);
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    expect(result.current.currentPoly).toBe(-1);
  });
});
