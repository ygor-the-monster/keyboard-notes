import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useDrone } from "./Drone.hooks.ts";

// Real Web Audio: useDrone layers sustained engine Voices (a chord). We assert the playing/stop
// lifecycle and that live pitch/volume/chord/timbre changes (via prop changes) don't throw against
// a real context.
afterEach(cleanup);

const base = { note: 9, octave: 4, volume: 0.2, chord: "root", timbre: "sine", a4: 440 };

describe("useDrone (real Web Audio)", () => {
  it("starts silent", () => {
    const { result } = renderHook(() => useDrone(base));
    expect(result.current.playing).toBe(false);
  });

  it("toggles the tone on and off", () => {
    const { result } = renderHook(() => useDrone(base));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it("live-updates pitch / volume / chord / timbre while sounding without throwing", () => {
    const { result, rerender } = renderHook((props: typeof base) => useDrone(props), {
      initialProps: base,
    });
    act(() => result.current.toggle());
    // Retune in place (same voice count), then a chord+timbre change that rebuilds the voices.
    expect(() => rerender({ ...base, note: 0, octave: 5, volume: 0.5, a4: 442 })).not.toThrow();
    expect(() => rerender({ ...base, chord: "tanpura", timbre: "warm" })).not.toThrow();
    act(() => result.current.toggle());
  });
});
