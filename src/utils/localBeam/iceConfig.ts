// Local Beam ICE configuration (ADR-0007). A public STUN server helps the two devices discover each
// other's addresses so pairing works same-Wi-Fi and across many networks. There is NO TURN — STUN
// only reflects addresses, it never relays data, so the Lesson stays strictly device-to-device. When
// STUN is off (or unreachable), ICE falls back to local-network candidates only.

export const STUN_SERVERS = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];

export function rtcConfig(useStun: boolean): RTCConfiguration {
  return { iceServers: useStun ? [{ urls: STUN_SERVERS }] : [] };
}

// Non-trickle ICE: resolve once gathering completes so the full SDP (candidates embedded) can be put
// in the QR. Bounded by a timeout so a slow/blocked STUN can't hang pairing — we proceed with the
// candidates gathered so far (e.g. LAN-only). Resolves immediately if gathering is already complete.
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}
