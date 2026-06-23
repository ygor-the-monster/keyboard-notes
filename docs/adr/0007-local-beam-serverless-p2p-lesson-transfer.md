# Local Beam transfers a Lesson peer-to-peer over WebRTC, with no signaling server

The Library lives only on the device (no account, no cloud). The one sanctioned way to move a Lesson
between devices is export/import a file. "Local Beam" adds a faster path for the teacher↔student case
in the same room: a teacher beams a Lesson straight to a student's browser. The constraint is the
app's identity — **on-device, private, offline-first** — so the transfer must not route the Lesson
through any server, and ideally must not need one at all.

## Decision

Send the serialized Lesson over an **encrypted WebRTC DataChannel established by exchanging two QR
codes** — no signaling server, no relay, no account. The Lesson never leaves the two devices.

- **Two-scan handshake.** WebRTC needs an offer and an answer before a channel opens, and the only
  offline channel between two phones is screen→camera. So the teacher (Send) shows an **offer QR**,
  the student (Receive) scans it and shows an **answer QR**, the teacher scans that back. Two scans
  is inherent to serverless WebRTC — one QR cannot carry a round-trip. We accept the friction to keep
  zero servers.
- **STUN for discovery, with a LAN-only fallback.** ICE uses a public STUN server so pairing works
  on the same Wi-Fi *and* across many networks; if STUN is unreachable (no internet, blocked), it
  degrades to local-network candidates only. STUN only helps the two devices learn each other's
  addresses — **no Lesson bytes ever touch it**, and there is no TURN relay.
- **Non-trickle, compressed SDP in the QR.** We gather ICE candidates fully (bounded by a timeout),
  then deflate + base64url the whole session description so the offer/answer each fit one QR
  (candidates capped to keep it small; an animated multi-frame QR is the fallback if it doesn't fit).
- **Chunked transfer with backpressure.** A Lesson embeds image/PDF/audio data-URLs and runs to MBs,
  past the DataChannel per-message cap. The sender frames the payload as `meta` → `chunk`* → `done`
  and throttles on `bufferedAmount`. The receiver reassembles, runs the **existing
  `coerceLesson`/`validateCell` trust boundary** (identical to file import — untrusted bytes are
  untrusted bytes), and only adds the Lesson after a confirm dialog showing title/size.
- **A short safety code confirms the pair.** DataChannels are DTLS-encrypted; the QRs carry the DTLS
  fingerprints, so tampering requires swapping *both* QRs. A short numeric code derived from the two
  fingerprints is shown on both screens for the users to eyeball-match (a deliberate MITM check).

## Why these shapes

- **No server is the point.** A relay (room code, one scan) would be smoother but would put
  connection metadata through a server we'd have to run and trust — a dent in the offline/privacy
  promise the rest of the app keeps. The two-scan dance is the cost of honesty here.
- **STUN is a fair compromise, TURN is not.** STUN is a stateless address-discovery ping; TURN
  relays the actual data. Allowing STUN (with LAN fallback) buys real-world reliability without ever
  relaying a Lesson; refusing TURN keeps the "device-to-device only" guarantee literally true.
- **Reuse the import trust boundary.** A beamed Lesson is exactly as untrusted as an imported file,
  so it flows through the same `coerceLesson` hardening and the same confirm-before-add step — no new
  trust surface.

## Boundaries

- **Same-moment, same-place.** Beam is for two people pairing now; it is not sync, backup, or a
  share link. File export/import remains the device-switch / archival path (see the deferred
  file-based sync idea).
- **One Lesson at a time.** Not the whole Library; that is what the backup export is for.
- **New surface, isolated.** WebRTC + camera + QR live behind an opt-in pairing screen (`#beam`);
  nothing in the existing editing/Library paths depends on them, and the camera is requested only
  while pairing. QR decode prefers the native `BarcodeDetector`, with a JS decoder fallback for
  browsers that lack it (iOS Safari, Firefox).
