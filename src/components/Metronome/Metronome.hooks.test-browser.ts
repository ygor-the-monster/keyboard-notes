import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useMetronome } from "./Metronome.hooks.ts";

// Real Web Audio: useMetronome drives a lookahead scheduler against the shared engine context.
// We assert the running lifecycle; cleanup() unmounts each hook so its scheduler interval is
// cleared between tests.
afterEach(cleanup);

describe("useMetronome (real Web Audio)", () => {
  it("starts stopped", () => {
    const { result } = renderHook(() => useMetronome({ bpm: 120, beats: 4 }));
    expect(result.current.running).toBe(false);
  });

  it("start() then stop() flips running and schedules clicks without throwing", () => {
    const { result } = renderHook(() => useMetronome({ bpm: 120, beats: 4 }));
    expect(() => act(() => result.current.start())).not.toThrow();
    expect(result.current.running).toBe(true);
    act(() => result.current.start()); // second start is a guarded no-op
    expect(result.current.running).toBe(true);
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
  });

  it("toggle() alternates running state", () => {
    const { result } = renderHook(() => useMetronome({ bpm: 90, beats: 3 }));
    act(() => result.current.toggle());
    expect(result.current.running).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.running).toBe(false);
  });
});
