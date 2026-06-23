// Local Beam wire protocol (ADR-0007). A serialized Lesson — `{ app, version, lesson }` JSON, which
// embeds image/PDF/audio data-URLs and so runs to MBs — is streamed over a WebRTC DataChannel as:
//
//   meta  (a JSON string control frame: title + total bytes + chunk count)
//   chunk*(binary frames: ordered slices of the UTF-8 payload)
//   done  (a JSON string control frame)
//
// Control frames are strings; chunks are binary (ArrayBuffer) — the receiver tells them apart by
// type, so no per-chunk header is needed. The DataChannel is reliable + ordered (SCTP default), so
// chunks arrive in order; meta's counts let the receiver detect a truncated transfer. This module is
// pure (no RTCPeerConnection) so the framing is unit-tested on its own; beamPeer drives the channel.

// 16 KB keeps each message well under the ~256 KB DataChannel cap on every browser.
export const CHUNK_BYTES = 16 * 1024;

export interface BeamMeta {
  t: "meta";
  title: string;
  bytes: number;
  chunks: number;
}
export interface BeamDone {
  t: "done";
}
export type BeamControl = BeamMeta | BeamDone;

export interface BeamFrames {
  meta: BeamMeta;
  chunks: Uint8Array[];
}

// Split a serialized Lesson into a meta frame + ordered binary chunks.
export function toFrames(json: string, title: string): BeamFrames {
  const bytes = new TextEncoder().encode(json);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_BYTES) {
    chunks.push(bytes.subarray(i, Math.min(i + CHUNK_BYTES, bytes.length)));
  }
  // A zero-length payload still sends one (empty) chunk, so meta.chunks and the stream always agree.
  if (chunks.length === 0) chunks.push(new Uint8Array(0));
  return { meta: { t: "meta", title, bytes: bytes.length, chunks: chunks.length }, chunks };
}

export const encodeControl = (frame: BeamControl): string => JSON.stringify(frame);

// Parse + validate a control frame off the wire; null for anything malformed (untrusted input).
export function decodeControl(raw: string): BeamControl | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.t === "done") return { t: "done" };
  if (
    o.t === "meta" &&
    typeof o.title === "string" &&
    typeof o.bytes === "number" &&
    Number.isInteger(o.bytes) &&
    o.bytes >= 0 &&
    typeof o.chunks === "number" &&
    Number.isInteger(o.chunks) &&
    o.chunks >= 0
  ) {
    return { t: "meta", title: o.title, bytes: o.bytes, chunks: o.chunks };
  }
  return null;
}

// Accumulates incoming chunks against the meta frame, then reconstructs the payload string. Stays
// dumb about Lesson shape — the caller JSON-parses + coerces the result through the import boundary.
export class Reassembler {
  private meta: BeamMeta | null = null;
  private parts: Uint8Array[] = [];
  private received = 0;

  begin(meta: BeamMeta): void {
    this.meta = meta;
    this.parts = [];
    this.received = 0;
  }

  push(chunk: Uint8Array): void {
    if (!this.meta) throw new Error("chunk before meta");
    this.parts.push(chunk);
    this.received += chunk.length;
  }

  // 0..1 fraction received (for a progress bar); 0 when meta is absent or payload is empty.
  get progress(): number {
    if (!this.meta || this.meta.bytes === 0) return this.meta ? 1 : 0;
    return Math.min(1, this.received / this.meta.bytes);
  }

  // Reconstruct the payload string, validating count + size so a truncated/over-long stream throws
  // rather than yielding a half Lesson.
  finish(): { title: string; json: string } {
    if (!this.meta) throw new Error("no meta frame");
    if (this.parts.length !== this.meta.chunks) throw new Error("chunk count mismatch");
    const total = this.parts.reduce((n, p) => n + p.length, 0);
    if (total !== this.meta.bytes) throw new Error("byte count mismatch");
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const p of this.parts) {
      buf.set(p, offset);
      offset += p.length;
    }
    return { title: this.meta.title, json: new TextDecoder().decode(buf) };
  }
}
