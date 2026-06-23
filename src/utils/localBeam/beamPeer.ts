// Local Beam peer orchestration (ADR-0007). Two roles drive a single DataChannel:
//
//   Sender (teacher):   createOffer() → [offer QR] → acceptAnswer(scan) → channel opens → stream
//   Receiver (student): acceptOffer(scan) → [answer QR] → channel opens → reassemble → onReceived
//
// Signaling is the two QR strings (see signaling.ts); ICE is non-trickle (waitForIceGathering) so
// each description carries its candidates. Payload framing is beamProtocol; the safety code is
// derived from both DTLS fingerprints. This is the thin imperative shell over those pure parts.

import { rtcConfig, waitForIceGathering } from "./iceConfig.ts";
import { encodeSignal, decodeSignal } from "./signaling.ts";
import { toFrames, encodeControl, decodeControl, Reassembler, type BeamMeta } from "./beamProtocol.ts";
import { safetyCode } from "./safetyCode.ts";

export type BeamPhase =
  | "idle"
  | "awaiting-scan" // sender shows offer / receiver shows answer, waiting for the other side
  | "connecting" // descriptions exchanged, ICE negotiating
  | "transferring"
  | "done"
  | "error";

export interface BeamEvents {
  onPhase?: (phase: BeamPhase) => void;
  onProgress?: (fraction: number) => void;
  onSafetyCode?: (code: string) => void;
  onReceived?: (result: { title: string; json: string }) => void; // receiver only
  onError?: (err: Error) => void;
}

const HIGH_WATER = 1 << 20; // 1 MB buffered → pause until it drains, so a big Lesson can't OOM

// Resolve when the channel's send buffer drains below the threshold (backpressure).
function whenDrained(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount < HIGH_WATER) return Promise.resolve();
  return new Promise((resolve) => {
    dc.bufferedAmountLowThreshold = HIGH_WATER / 2;
    const onLow = () => {
      dc.removeEventListener("bufferedamountlow", onLow);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", onLow);
  });
}

abstract class BeamPeer {
  protected pc: RTCPeerConnection;
  protected events: BeamEvents;
  private closed = false;

  constructor(events: BeamEvents, useStun: boolean) {
    this.events = events;
    this.pc = new RTCPeerConnection(rtcConfig(useStun));
    this.pc.addEventListener("connectionstatechange", () => {
      const s = this.pc.connectionState;
      if (s === "failed" || s === "disconnected") this.fail(new Error("connection lost"));
    });
  }

  protected phase(p: BeamPhase): void {
    this.events.onPhase?.(p);
  }

  protected fail(err: Error): void {
    if (this.closed) return;
    this.phase("error");
    this.events.onError?.(err);
  }

  // Once both descriptions are set, surface the safety code for the users to eyeball-match.
  protected emitSafetyCode(): void {
    const local = this.pc.localDescription?.sdp;
    const remote = this.pc.remoteDescription?.sdp;
    if (!local || !remote) return;
    const code = safetyCode(local, remote);
    if (code) this.events.onSafetyCode?.(code);
  }

  close(): void {
    this.closed = true;
    try {
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

export class BeamSender extends BeamPeer {
  private dc: RTCDataChannel;
  private payload: { json: string; title: string } | null = null;

  constructor(events: BeamEvents, useStun: boolean) {
    super(events, useStun);
    this.dc = this.pc.createDataChannel("beam", { ordered: true });
    this.dc.binaryType = "arraybuffer";
    this.dc.addEventListener("open", () => void this.stream());
  }

  // The Lesson to beam, serialized (e.g. via serializeLesson) plus a display title.
  setPayload(json: string, title: string): void {
    this.payload = { json, title };
  }

  // Build the offer to show as QR #1.
  async createOffer(): Promise<string> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);
    this.phase("awaiting-scan");
    return encodeSignal({ type: "offer", sdp: this.pc.localDescription!.sdp });
  }

  // Apply the student's scanned answer (QR #2); the channel then opens and streaming begins.
  async acceptAnswer(answerCode: string): Promise<void> {
    const answer = await decodeSignal(answerCode);
    if (answer.type !== "answer") throw new Error("Expected an answer code");
    await this.pc.setRemoteDescription(answer);
    this.emitSafetyCode();
    this.phase("connecting");
  }

  private async stream(): Promise<void> {
    if (!this.payload) return this.fail(new Error("no payload set"));
    try {
      this.phase("transferring");
      const { meta, chunks } = toFrames(this.payload.json, this.payload.title);
      this.dc.send(encodeControl(meta));
      let sent = 0;
      for (const chunk of chunks) {
        await whenDrained(this.dc);
        // Copy out of the shared subarray buffer so the exact bytes are sent.
        this.dc.send(chunk.slice().buffer);
        sent += chunk.length;
        this.events.onProgress?.(meta.bytes ? sent / meta.bytes : 1);
      }
      this.dc.send(encodeControl({ t: "done" }));
      this.phase("done");
    } catch (err) {
      this.fail(err as Error);
    }
  }
}

export class BeamReceiver extends BeamPeer {
  private reassembler = new Reassembler();
  private meta: BeamMeta | null = null;

  constructor(events: BeamEvents, useStun: boolean) {
    super(events, useStun);
    this.pc.addEventListener("datachannel", (e) => this.wire(e.channel));
  }

  // Apply the teacher's scanned offer (QR #1) and produce the answer to show as QR #2.
  async acceptOffer(offerCode: string): Promise<string> {
    const offer = await decodeSignal(offerCode);
    if (offer.type !== "offer") throw new Error("Expected an offer code");
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceGathering(this.pc);
    this.emitSafetyCode();
    this.phase("awaiting-scan");
    return encodeSignal({ type: "answer", sdp: this.pc.localDescription!.sdp });
  }

  private wire(dc: RTCDataChannel): void {
    dc.binaryType = "arraybuffer";
    this.phase("connecting");
    dc.addEventListener("message", (e) => this.onMessage(e.data));
  }

  private onMessage(data: string | ArrayBuffer): void {
    try {
      if (typeof data === "string") {
        const frame = decodeControl(data);
        if (!frame) return;
        if (frame.t === "meta") {
          this.meta = frame;
          this.reassembler.begin(frame);
          this.phase("transferring");
        } else if (frame.t === "done") {
          const result = this.reassembler.finish();
          this.phase("done");
          this.events.onReceived?.(result);
        }
        return;
      }
      this.reassembler.push(new Uint8Array(data));
      this.events.onProgress?.(this.reassembler.progress);
    } catch (err) {
      this.fail(err as Error);
    }
  }
}
