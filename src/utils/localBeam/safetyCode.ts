// Local Beam safety code (ADR-0007). DataChannels are DTLS-encrypted and the QRs carry each peer's
// DTLS fingerprint, so tampering means swapping BOTH QRs. We surface a short code derived from the
// two fingerprints on both screens; if they don't match, the pairing was tampered. Not a secret —
// just a deterministic, order-independent digest both sides can eyeball-compare. Pure + sync so it's
// trivially unit-tested.

// Pull the DTLS fingerprint hex out of an SDP (`a=fingerprint:sha-256 AB:CD:…`), colons stripped.
export function fingerprintOf(sdp: string): string | null {
  const m = /a=fingerprint:\S+\s+([0-9A-Fa-f:]+)/.exec(sdp);
  return m ? m[1].replace(/:/g, "").toUpperCase() : null;
}

// FNV-1a (32-bit) — deterministic, dependency-free, synchronous. Sufficient for a confirmation
// digest (DTLS provides the actual security; this only has to differ when the fingerprints differ).
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A 6-digit code from both peers' fingerprints, order-independent so both ends compute the same
// value. Null if either SDP lacks a fingerprint (not yet ready to compare).
export function safetyCode(sdpA: string, sdpB: string): string | null {
  const a = fingerprintOf(sdpA);
  const b = fingerprintOf(sdpB);
  if (!a || !b) return null;
  const code = fnv1a([a, b].sort().join("|")) % 1_000_000;
  return String(code).padStart(6, "0");
}

// "123456" → "123 456" for a readable on-screen grouping.
export const formatSafetyCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
