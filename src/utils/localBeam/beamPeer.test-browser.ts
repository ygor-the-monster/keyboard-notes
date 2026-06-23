import { describe, it, expect } from "vitest";
import { BeamSender, BeamReceiver } from "./beamPeer.ts";

// End-to-end over a REAL DataChannel: a sender and receiver in the same page connect to each other
// (offer/answer piped in-process instead of via QR, STUN off so it stays loopback-local) and beam a
// Lesson. This covers beamPeer + beamProtocol + signaling + safetyCode together; QR/camera are the
// only untested seam, exercised by the BeamScreen component tests.

function beam(json: string, title: string) {
  return new Promise<{
    result: { title: string; json: string };
    senderCode?: string;
    receiverCode?: string;
  }>((resolve, reject) => {
    let senderCode: string | undefined;
    let receiverCode: string | undefined;
    const receiver = new BeamReceiver(
      {
        onSafetyCode: (c) => (receiverCode = c),
        onReceived: (result) => settle(() => resolve({ result, senderCode, receiverCode })),
        onError: (e) => settle(() => reject(e)),
      },
      false,
    );
    const sender = new BeamSender(
      { onSafetyCode: (c) => (senderCode = c), onError: (e) => settle(() => reject(e)) },
      false,
    );
    // Always close both peers when the beam settles, so connections never leak between tests.
    const settle = (fn: () => void) => {
      sender.close();
      receiver.close();
      fn();
    };
    sender.setPayload(json, title);
    void (async () => {
      const offer = await sender.createOffer();
      const answer = await receiver.acceptOffer(offer);
      await sender.acceptAnswer(answer);
    })().catch((e) => settle(() => reject(e)));
  });
}

describe("Local Beam loopback", () => {
  it("beams a small lesson sender→receiver byte-for-byte", async () => {
    const json = JSON.stringify({
      app: "pianoNotes",
      version: 3,
      lesson: { id: "id-x", title: "Loopback", created: 1, updated: 1, cells: [] },
    });
    const { result, senderCode, receiverCode } = await beam(json, "Loopback");
    expect(result.json).toBe(json);
    expect(result.title).toBe("Loopback");
    // Both peers derive the SAME safety code from the two fingerprints.
    expect(senderCode).toMatch(/^\d{6}$/);
    expect(senderCode).toBe(receiverCode);
  }, 15000);

  it("beams a multi-chunk payload (exercises chunking + backpressure)", async () => {
    // ~600 KB of embedded-media-like text → dozens of 16 KB chunks.
    const big = "data:audio/wav;base64," + "A".repeat(600 * 1024);
    const json = JSON.stringify({
      app: "pianoNotes",
      version: 3,
      lesson: {
        id: "id-y",
        title: "Big",
        created: 1,
        updated: 1,
        cells: [{ id: "c1", kind: "audio", dataUrl: big, marks: [] }],
      },
    });
    const { result } = await beam(json, "Big");
    expect(result.json).toBe(json);
    expect(result.json.length).toBe(json.length);
  }, 20000);
});
