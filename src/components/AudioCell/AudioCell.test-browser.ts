import { describe, it, expect } from "vitest";
import {
  encodeWav,
  spliceBuffer,
  sliceBuffer,
  computePeaks,
  decodeDataUrl,
  fileToDataUrl,
} from "./AudioCell.utils.ts";

// Real Web Audio (Chromium). OfflineAudioContext needs no user gesture, so buffer math is
// deterministic and headless-friendly — unlike a live AudioContext.
const RATE = 8000;
const ctx = new OfflineAudioContext(1, RATE, RATE);
function buf(seconds: number, fill = 0.5) {
  const b = ctx.createBuffer(1, Math.round(seconds * RATE), RATE);
  b.getChannelData(0).fill(fill);
  return b;
}

describe("AudioCell.utils (real Web Audio)", () => {
  it("encodeWav emits a RIFF/WAVE blob of the right byte length", async () => {
    const b = buf(0.1);
    const bytes = new Uint8Array(await encodeWav(b).arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(bytes.length).toBe(44 + b.length * 2);
  });

  it("sliceBuffer keeps exactly the [start,end) span", () => {
    expect(sliceBuffer(ctx, buf(1), 0.25, 0.75).length).toBe(Math.round(0.5 * RATE));
  });

  it("spliceBuffer length = before + insert + after", () => {
    const base = buf(1);
    const insert = buf(0.2);
    const out = spliceBuffer(ctx, base, insert, 0.25, 0.75);
    const s = Math.floor(0.25 * RATE);
    const e = Math.floor(0.75 * RATE);
    expect(out.length).toBe(s + insert.length + (base.length - e));
  });

  it("computePeaks returns one peak per bucket reflecting amplitude", () => {
    const peaks = computePeaks(buf(1, 0.8), 10);
    expect(peaks.length).toBe(10);
    expect(peaks[0]).toBeCloseTo(0.8, 4);
  });

  it("encode → dataURL → decode round-trips the duration", async () => {
    const decoded = await decodeDataUrl(await fileToDataUrl(encodeWav(buf(0.5))));
    expect(decoded.duration).toBeCloseTo(0.5, 1);
  });
});
