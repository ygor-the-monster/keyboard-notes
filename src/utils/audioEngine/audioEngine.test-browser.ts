import { describe, it, expect } from "vitest";
import { output, resume, tone, startTone } from "./audioEngine.ts";

describe("audio engine (real Web Audio)", () => {
  it("output() returns a single shared AudioContext", () => {
    expect(output()).toBe(output());
    expect(output().destination).toBeDefined();
  });

  it("resume() is idempotent and safe", () => {
    expect(() => {
      resume();
      resume();
    }).not.toThrow();
  });

  it("tone() schedules a one-shot voice without throwing", () => {
    expect(() => tone({ freq: 440, gain: 0.2, duration: 0.01 })).not.toThrow();
  });

  it("startTone() returns a controllable, stoppable Voice", () => {
    const voice = startTone({ freq: 220 });
    expect(() => {
      voice.setFrequency(330);
      voice.setGain(0.1);
      voice.stop(0.01);
      voice.stop(0.01); // second stop is a no-op
    }).not.toThrow();
  });
});
