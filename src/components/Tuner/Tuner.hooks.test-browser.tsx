import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { hzToNote, useTuner } from "./Tuner.hooks.ts";
import { I18nProvider } from "../../providers/I18nProvider/I18nProvider.tsx";
import { DialogProvider } from "../../providers/DialogProvider/DialogProvider.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// A real MediaStream synthesized from an oscillator, so getUserMedia can be stubbed deterministically
// (no physical mic / fake-device flags needed). createMediaStreamSource accepts it like a live mic.
function fakeMicStream(): MediaStream {
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  const osc = ctx.createOscillator();
  osc.connect(dest);
  osc.start();
  return dest.stream;
}

// useTuner reads useDialog (to warn on mic failure), which itself needs I18n.
const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>
    <DialogProvider>{children}</DialogProvider>
  </I18nProvider>
);

describe("hzToNote", () => {
  it("maps reference pitches to note / octave / cents", () => {
    expect(hzToNote(440)).toEqual({ note: "A", octave: 4, cents: 0 });
    const c4 = hzToNote(261.626);
    expect(c4.note).toBe("C");
    expect(c4.octave).toBe(4);
    expect(Math.abs(c4.cents)).toBeLessThanOrEqual(1);
  });

  it("respects a custom A4 reference", () => {
    expect(hzToNote(442, 442)).toMatchObject({ note: "A", octave: 4, cents: 0 });
  });

  it("reports cents sharp (+) or flat (−) of the nearest note", () => {
    expect(hzToNote(445).cents).toBeGreaterThan(0);
    expect(hzToNote(435).cents).toBeLessThan(0);
  });
});

describe("useTuner (fake microphone)", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useTuner(), { wrapper });
    expect(result.current.listening).toBe(false);
    expect(result.current.reading).toBeNull();
  });

  it("toggles microphone listening on and back off", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(fakeMicStream());
    const { result } = renderHook(() => useTuner(), { wrapper });
    act(() => void result.current.toggle());
    await waitFor(() => expect(result.current.listening).toBe(true));
    act(() => void result.current.toggle());
    expect(result.current.listening).toBe(false);
    expect(result.current.reading).toBeNull();
  });
});
