// Timestamp Anchors — a Note can hold a link that jumps a media Cell (Audio or External video) to a
// moment in time. This is the cross-Cell channel between the clicked anchor and the target player.
//
// A module-level pub/sub (like the toast singleton) so a click handler — even non-React — can hand a
// seek to whichever player is mounted for the target Cell. One handler per Cell (one player instance
// per Cell). A `pending` latch covers the Audio case: clicking an anchor opens that Cell's player
// (it mounts a frame later), so the seek is parked and the player consumes it as it subscribes.

// Authoring syntax for a timestamp anchor in Note Markdown: `[[<code>:<time>|<label?>]]`, e.g.
// `[[A3:0:45]]` or `[[V7:1:30|the run]]`. `<code>` is a short, stable, user-visible Cell code (see
// cellSeekCode) — never the opaque internal id, so a person can read and hand-author these. `<time>`
// is a timecode (m:ss / h:mm:ss / bare seconds); `<label>` is optional.
//
// Deliberately a CUSTOM token, not a Markdown link — a link would render as `<a href="#…">`, and
// `#…` fragments are the app's router screens (RouteProvider). A hash anchor would drive navigation
// (only half-tamed by preventDefault); a custom token renders to a <button> with the target in
// data-* attributes instead, so the router never sees it. The marked extension lives in
// NoteCell.utils; this is the shared format contract (matcher + builder + code helpers).
export const SEEK_TOKEN_RE = /^\[\[([A-Za-z0-9]+):([\d:.]+)(?:\|([\s\S]*?))?\]\]/;

// Build a token from a Cell code + time, with an optional label. Time is stored as a human timecode
// (so the source stays readable); the label is omitted when empty for a tidy `[[A3:0:45]]`.
export function buildSeekToken(code: string, seconds: number, label?: string): string {
  const body = `[[${code}:${fmtTimecode(seconds)}`;
  return label && label.trim() ? `${body}|${label.trim()}]]` : `${body}]]`;
}

// A short, stable, user-visible handle for a seek-able media Cell — shown as a copyable badge on the
// Cell and used as `<code>` in the token above. Derived from the Cell's own id, so it never shifts
// when the lesson is reordered. Prefix marks the kind: A = Audio, V = video (External).
export function cellSeekCode(cell: { id: string; kind: string }): string {
  const prefix = cell.kind === "audio" ? "A" : "V";
  const tail = cell.id.replace(/[^a-z0-9]/gi, "").slice(-3).toUpperCase();
  return prefix + tail;
}

// Resolve a token's `<code>` back to its Cell (case-insensitive), among the seek-able kinds only.
export function findCellByCode<C extends { id: string; kind: string }>(
  cells: C[],
  code: string,
): C | undefined {
  const want = code.trim().toUpperCase();
  return cells.find(
    (c) => (c.kind === "audio" || c.kind === "external") && cellSeekCode(c) === want,
  );
}

// Parse a human timecode into seconds: "83" → 83, "1:23" → 83, "1:02:03" → 3723. Returns null for
// anything that isn't a non-negative time, so the picker can reject bad input.
export function parseTimecode(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length > 3) return null;
  let total = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null;
    total = total * 60 + Number(part);
  }
  return Number.isFinite(total) && total >= 0 ? total : null;
}

// Render seconds as a compact timecode (m:ss, or h:mm:ss past an hour) for anchor labels + readouts.
export function fmtTimecode(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

type Handler = (seconds: number) => void;
const handlers = new Map<string, Handler>();
const pending = new Map<string, { seconds: number; at: number }>();
// A parked seek older than this is stale (the player it was meant for never mounted) — drop it so it
// can't fire much later when the user opens that Cell for an unrelated reason.
const PENDING_TTL = 5000;

// Ask the player for `cellId` to seek. If it's mounted, it seeks now; otherwise the request is parked
// for the player to consume when it subscribes (the Audio "open then seek" path).
export function requestSeek(cellId: string, seconds: number, now: number = Date.now()): void {
  const handler = handlers.get(cellId);
  if (handler) handler(seconds);
  else pending.set(cellId, { seconds, at: now });
}

// A mounted player subscribes for its Cell; the returned unsubscribe is for unmount. Any fresh parked
// seek is delivered immediately on subscribe.
export function onSeek(cellId: string, handler: Handler, now: number = Date.now()): () => void {
  handlers.set(cellId, handler);
  const parked = pending.get(cellId);
  if (parked) {
    pending.delete(cellId);
    if (now - parked.at <= PENDING_TTL) handler(parked.seconds);
  }
  return () => {
    if (handlers.get(cellId) === handler) handlers.delete(cellId);
  };
}
