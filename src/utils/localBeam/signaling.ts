// Local Beam signaling payload (ADR-0007). The offer/answer session description has to fit in a QR
// code, so we JSON-wrap {type, sdp}, deflate it, and base64url the bytes. Deflate roughly halves a
// DataChannel SDP (lots of repeated token/candidate text); a typical one lands well under a QR's
// byte-mode capacity (~2953 chars). If a future SDP overflows, BeamScreen splits it into an animated
// multi-frame QR — this module just owns the single-blob encoding. Async because CompressionStream
// is stream-based; pure otherwise, so it round-trips in tests without any RTCPeerConnection.

export interface Signal {
  type: RTCSdpType; // "offer" | "answer"
  sdp: string;
}

async function pump(input: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = transform.writable.getWriter();
  // On bad input the stream errors and both sides reject; swallow the writer-side rejection here so
  // it isn't unhandled — the reader.read() rejection below is what we surface to the caller.
  const written = writer
    .write(input as BufferSource)
    .then(() => writer.close())
    .catch(() => {});
  const reader = transform.readable.getReader();
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) parts.push(value);
    }
  } finally {
    await written;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Encode a session description into the compact string a QR carries.
export async function encodeSignal(desc: Signal): Promise<string> {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  const deflated = await pump(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return toBase64Url(deflated);
}

// Decode a scanned QR string back into a session description; throws if it isn't a Beam signal.
export async function decodeSignal(text: string): Promise<Signal> {
  let json: string;
  try {
    const inflated = await pump(fromBase64Url(text.trim()), new DecompressionStream("deflate-raw"));
    json = new TextDecoder().decode(inflated);
  } catch {
    throw new Error("Not a Local Beam code");
  }
  let v: unknown;
  try {
    v = JSON.parse(json);
  } catch {
    throw new Error("Not a Local Beam code");
  }
  const o = v as Record<string, unknown>;
  if (!o || (o.t !== "offer" && o.t !== "answer") || typeof o.s !== "string") {
    throw new Error("Not a Local Beam code");
  }
  return { type: o.t, sdp: o.s };
}
