import { describe, it, expect } from "vitest";
import { encodeSignal, decodeSignal } from "./signaling.ts";

// A representative DataChannel offer with host + srflx + mDNS candidates — the realistic worst case
// for QR sizing.
const SAMPLE_SDP = `v=0\r
o=- 4611731400430051336 2 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0\r
a=msid-semantic: WMS\r
m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r
c=IN IP4 0.0.0.0\r
a=candidate:1 1 udp 2122260223 192.168.1.42 51234 typ host generation 0\r
a=candidate:2 1 udp 2122194687 a1b2c3d4-e5f6-7890-abcd-ef1234567890.local 51235 typ host\r
a=candidate:3 1 udp 1686052607 203.0.113.7 51236 typ srflx raddr 192.168.1.42 rport 51234\r
a=ice-ufrag:F7gH\r
a=ice-pwd:x9Yz0123456789abcdefABCD\r
a=ice-options:trickle\r
a=fingerprint:sha-256 AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89\r
a=setup:actpass\r
a=mid:0\r
a=sctp-port:5000\r
a=max-message-size:262144\r
`;

describe("signal encode/decode", () => {
  it("round-trips a session description", async () => {
    const code = await encodeSignal({ type: "offer", sdp: SAMPLE_SDP });
    const back = await decodeSignal(code);
    expect(back.type).toBe("offer");
    expect(back.sdp).toBe(SAMPLE_SDP);
  });

  it("produces a URL-safe string (no +/=, no whitespace)", async () => {
    const code = await encodeSignal({ type: "answer", sdp: SAMPLE_SDP });
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("compresses to within a single QR's byte capacity (<2953 chars)", async () => {
    const code = await encodeSignal({ type: "offer", sdp: SAMPLE_SDP });
    // Deflate should roughly halve the SDP; assert it comfortably fits one QR.
    expect(code.length).toBeLessThan(2000);
    expect(code.length).toBeLessThan(SAMPLE_SDP.length);
  });

  it("rejects a string that isn't a Beam code", async () => {
    await expect(decodeSignal("totally not base64url $$$")).rejects.toThrow(/Local Beam/);
  });

  it("rejects a base64url blob that isn't deflate data", async () => {
    await expect(decodeSignal("aGVsbG8gd29ybGQ")).rejects.toThrow(/Local Beam/);
  });
});
