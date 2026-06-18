// Audio helpers for the audio cell: file/blob → dataURL, Web Audio decode, waveform peaks,
// region splicing, and a small mono 16-bit WAV encoder (used after any edit that needs to
// re-encode — splice / trim / delete — since the browser can't re-encode to opus offline).
import { output } from "../../utils/audioEngine/audioEngine.ts";
import type { Mark } from "../../utils/cellKinds/cellKinds.ts";
export { fileToDataUrl } from "../../utils/fileToDataUrl/fileToDataUrl.ts";

// Audio-cell decode + buffer math run on the shared output context from the engine.
export function audioCtx(): AudioContext {
  return output();
}

export async function decodeDataUrl(dataUrl: string): Promise<AudioBuffer> {
  const buf = await (await fetch(dataUrl)).arrayBuffer();
  return audioCtx().decodeAudioData(buf);
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  return audioCtx().decodeAudioData(await blob.arrayBuffer());
}

// Max-amplitude peak per bucket (channel 0) — drives the waveform bars.
export function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const ch = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(ch.length / buckets));
  const peaks = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < ch.length; j++) {
      const v = Math.abs(ch[start + j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

// Replace the [startSec, endSec) region of `base` with `insert` (or remove it when insert is
// null). Returns a new mono AudioBuffer. base and insert must share a sample rate.
export function spliceBuffer(
  ctx: BaseAudioContext,
  base: AudioBuffer,
  insert: AudioBuffer | null,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const rate = base.sampleRate;
  const s = Math.max(0, Math.floor(startSec * rate));
  const e = Math.min(base.length, Math.floor(endSec * rate));
  const insLen = insert ? insert.length : 0;
  const total = s + insLen + (base.length - e);
  const out = ctx.createBuffer(1, Math.max(1, total), rate);
  const o = out.getChannelData(0);
  const b = base.getChannelData(0);
  o.set(b.subarray(0, s), 0);
  if (insert) o.set(insert.getChannelData(0).subarray(0, insLen), s);
  o.set(b.subarray(e), s + insLen);
  return out;
}

export function sliceBuffer(
  ctx: BaseAudioContext,
  base: AudioBuffer,
  startSec: number,
  endSec: number,
): AudioBuffer {
  const rate = base.sampleRate;
  const s = Math.max(0, Math.floor(startSec * rate));
  const e = Math.min(base.length, Math.floor(endSec * rate));
  const out = ctx.createBuffer(1, Math.max(1, e - s), rate);
  out.getChannelData(0).set(base.getChannelData(0).subarray(s, e));
  return out;
}

// Mono 16-bit PCM WAV from an AudioBuffer.
export function encodeWav(buffer: AudioBuffer): Blob {
  const rate = buffer.sampleRate;
  const len = buffer.length;
  const data = buffer.getChannelData(0);
  const dataSize = len * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  dv.setUint32(4, 36 + dataSize, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits
  str(36, "data");
  dv.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    dv.setInt16(off, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

// Format seconds as m:ss.
export function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ---- Annotation marks (non-destructive overlay on the waveform) -------------------
// A mark is a timed pin or a span region, each with a colour and a note.

// After a TRIM to [start,end): keep only marks intersecting the kept range and rebase their times
// to the new zero. Out-of-range marks are dropped.
export function remapMarksAfterTrim(marks: Mark[], start: number, end: number): Mark[] {
  const out: Mark[] = [];
  for (const m of marks || []) {
    if (m.kind === "region") {
      const s = Math.max(m.time, start);
      const e = Math.min(m.end ?? m.time, end);
      if (e - s > 0.02) out.push({ ...m, time: s - start, end: e - start });
    } else if (m.time >= start && m.time <= end) {
      out.push({ ...m, time: m.time - start });
    }
  }
  return out;
}

// After DELETING the [start,end) span: drop marks inside it and pull later marks back by the
// removed duration. Regions overlapping the cut are clamped.
export function remapMarksAfterCut(marks: Mark[], start: number, end: number): Mark[] {
  const span = end - start;
  const out: Mark[] = [];
  for (const m of marks || []) {
    if (m.kind === "region") {
      let s = m.time;
      let e = m.end ?? m.time;
      if (e <= start) {
        out.push({ ...m });
      } else if (s >= end) {
        out.push({ ...m, time: s - span, end: e - span });
      } else {
        // overlaps the cut — remove the cut portion, keep what survives on either side
        s = s < start ? s : start;
        e = e > end ? e - span : start;
        if (e - s > 0.02) out.push({ ...m, time: s, end: e });
      }
    } else if (m.time <= start) {
      out.push({ ...m });
    } else if (m.time >= end) {
      out.push({ ...m, time: m.time - span });
    }
    // points strictly inside the cut are dropped
  }
  return out;
}
