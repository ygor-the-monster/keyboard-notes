import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useDrone } from "./Drone.hooks.ts";

// Real Web Audio: useDrone wraps a sustained engine Voice. We assert the playing/stop lifecycle
// and that live frequency/volume updates (via prop changes) don't throw against a real context.
afterEach(cleanup);

describe("useDrone (real Web Audio)", () => {
  it("starts silent", () => {
    const { result } = renderHook(() => useDrone({ note: 9, octave: 4, volume: 0.2 }));
    expect(result.current.playing).toBe(false);
  });

  it("toggles the tone on and off", () => {
    const { result } = renderHook(() => useDrone({ note: 9, octave: 4, volume: 0.2 }));
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it("live-updates pitch and volume while sounding without throwing", () => {
    const { result, rerender } = renderHook(
      (props: { note: number; octave: number; volume: number }) => useDrone(props),
      {
        initialProps: { note: 9, octave: 4, volume: 0.2 },
      },
    );
    act(() => result.current.toggle());
    expect(() => rerender({ note: 0, octave: 5, volume: 0.5 })).not.toThrow();
    act(() => result.current.toggle());
  });
});
