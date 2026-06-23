import { describe, it, expect } from "vitest";
import {
  CHUNK_BYTES,
  toFrames,
  encodeControl,
  decodeControl,
  Reassembler,
} from "./beamProtocol.ts";

// Stream a payload through frames → Reassembler exactly as beamPeer would over the channel.
function roundTrip(json: string, title = "Lesson"): { title: string; json: string } {
  const { meta, chunks } = toFrames(json, title);
  const r = new Reassembler();
  r.begin(decodeControl(encodeControl(meta)) as typeof meta);
  for (const c of chunks) r.push(c);
  return r.finish();
}

describe("toFrames / Reassembler round-trip", () => {
  it("rebuilds a small payload byte-for-byte", () => {
    const json = JSON.stringify({ app: "pianoNotes", version: 3, lesson: { title: "Czerny" } });
    expect(roundTrip(json, "Czerny").json).toBe(json);
  });

  it("rebuilds a multi-chunk payload and reports the right chunk count", () => {
    const json = "x".repeat(CHUNK_BYTES * 3 + 17); // 4 chunks
    const { meta } = toFrames(json, "Big");
    expect(meta.chunks).toBe(4);
    expect(meta.bytes).toBe(CHUNK_BYTES * 3 + 17);
    expect(roundTrip(json, "Big").json).toBe(json);
  });

  it("preserves multi-byte UTF-8 across chunk boundaries", () => {
    const json = "café—🎹".repeat(5000); // forces multi-byte splits mid-stream
    expect(roundTrip(json).json).toBe(json);
  });

  it("always emits at least one chunk, even for an empty payload", () => {
    const { meta, chunks } = toFrames("", "Empty");
    expect(meta.chunks).toBe(1);
    expect(chunks).toHaveLength(1);
    expect(roundTrip("").json).toBe("");
  });
});

describe("Reassembler validation", () => {
  it("throws on a truncated stream (missing a chunk)", () => {
    const { meta, chunks } = toFrames("y".repeat(CHUNK_BYTES * 2), "T");
    const r = new Reassembler();
    r.begin(meta);
    r.push(chunks[0]); // drop chunks[1]
    expect(() => r.finish()).toThrow(/chunk count/);
  });

  it("throws when bytes don't add up", () => {
    const { meta } = toFrames("z".repeat(100), "T");
    const r = new Reassembler();
    r.begin(meta);
    // Right count, wrong size.
    for (let i = 0; i < meta.chunks; i++) r.push(new Uint8Array(99));
    expect(() => r.finish()).toThrow(/byte count/);
  });

  it("reports progress as a 0..1 fraction", () => {
    const { meta, chunks } = toFrames("w".repeat(CHUNK_BYTES * 4), "T");
    const r = new Reassembler();
    expect(r.progress).toBe(0); // no meta yet
    r.begin(meta);
    r.push(chunks[0]);
    r.push(chunks[1]);
    expect(r.progress).toBeCloseTo(0.5, 5);
  });

  it("rejects a chunk that arrives before meta", () => {
    const r = new Reassembler();
    expect(() => r.push(new Uint8Array(1))).toThrow(/before meta/);
  });
});

describe("control frame encode/decode", () => {
  it("round-trips meta and done", () => {
    expect(decodeControl(encodeControl({ t: "done" }))).toEqual({ t: "done" });
    const meta = { t: "meta" as const, title: "A", bytes: 10, chunks: 1 };
    expect(decodeControl(encodeControl(meta))).toEqual(meta);
  });

  it("rejects malformed / hostile control frames", () => {
    expect(decodeControl("not json")).toBeNull();
    expect(decodeControl("{}")).toBeNull();
    expect(decodeControl('{"t":"meta","title":"x","bytes":-1,"chunks":1}')).toBeNull();
    expect(decodeControl('{"t":"meta","title":1,"bytes":1,"chunks":1}')).toBeNull();
    expect(decodeControl('{"t":"evil"}')).toBeNull();
  });
});
