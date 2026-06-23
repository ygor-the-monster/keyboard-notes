import { describe, it, expect, vi } from "vitest";
import {
  SEEK_TOKEN_RE,
  buildSeekToken,
  cellSeekCode,
  findCellByCode,
  parseTimecode,
  fmtTimecode,
  requestSeek,
  onSeek,
} from "./seekBus.ts";

describe("seek token", () => {
  it("builds [[code:time|label]] with a human timecode and no #href", () => {
    const tok = buildSeekToken("A3F", 83, "go to chorus");
    expect(tok).toBe("[[A3F:1:23|go to chorus]]");
    expect(tok).not.toContain("#"); // never a router-visible hash
  });

  it("omits the label when blank for a tidy token", () => {
    expect(buildSeekToken("V7Q", 45)).toBe("[[V7Q:0:45]]");
    expect(buildSeekToken("V7Q", 45, "  ")).toBe("[[V7Q:0:45]]");
  });

  it("the matcher captures code, time and optional label", () => {
    const withLabel = SEEK_TOKEN_RE.exec("[[A3F:1:23|the run]]");
    expect(withLabel?.[1]).toBe("A3F");
    expect(withLabel?.[2]).toBe("1:23");
    expect(withLabel?.[3]).toBe("the run");
    const bare = SEEK_TOKEN_RE.exec("[[V7Q:0:45]]");
    expect(bare?.[1]).toBe("V7Q");
    expect(bare?.[2]).toBe("0:45");
    expect(bare?.[3]).toBeUndefined();
  });

  it("the matcher is anchored and ignores non-tokens", () => {
    expect(SEEK_TOKEN_RE.exec("see [[A3F:0:45]]")).toBeNull(); // not at start
    expect(SEEK_TOKEN_RE.exec("[[no colon]]")).toBeNull();
  });
});

describe("cell codes", () => {
  it("derives a stable, kind-prefixed code from the cell id", () => {
    expect(cellSeekCode({ id: "id-abc123x", kind: "audio" })).toBe("A23X");
    expect(cellSeekCode({ id: "id-abc123x", kind: "external" })).toBe("V23X");
  });

  it("resolves a code back to its cell (case-insensitive), seek-able kinds only", () => {
    const cells = [
      { id: "id-note00", kind: "note" },
      { id: "id-abc123x", kind: "audio" },
      { id: "id-def456y", kind: "external" },
    ];
    expect(findCellByCode(cells, "A23X")?.id).toBe("id-abc123x");
    expect(findCellByCode(cells, "v56y")?.id).toBe("id-def456y");
    expect(findCellByCode(cells, "ZZZ")).toBeUndefined();
  });
});

describe("parseTimecode", () => {
  it("parses seconds, m:ss and h:mm:ss", () => {
    expect(parseTimecode("83")).toBe(83);
    expect(parseTimecode("1:23")).toBe(83);
    expect(parseTimecode("1:02:03")).toBe(3723);
    expect(parseTimecode(" 0:30 ")).toBe(30);
  });
  it("rejects junk", () => {
    expect(parseTimecode("")).toBeNull();
    expect(parseTimecode("abc")).toBeNull();
    expect(parseTimecode("1:2:3:4")).toBeNull();
  });
});

describe("fmtTimecode", () => {
  it("formats m:ss and h:mm:ss", () => {
    expect(fmtTimecode(83)).toBe("1:23");
    expect(fmtTimecode(5)).toBe("0:05");
    expect(fmtTimecode(3723)).toBe("1:02:03");
  });
});

describe("seek bus delivery", () => {
  it("delivers immediately to a mounted handler", () => {
    const fn = vi.fn();
    const off = onSeek("id-mounted", fn);
    requestSeek("id-mounted", 42);
    expect(fn).toHaveBeenCalledWith(42);
    off();
  });

  it("parks a seek and delivers it when the player subscribes (open-then-seek)", () => {
    const fn = vi.fn();
    requestSeek("id-later", 12, 1000);
    expect(fn).not.toHaveBeenCalled();
    const off = onSeek("id-later", fn, 1200); // within TTL
    expect(fn).toHaveBeenCalledWith(12);
    off();
  });

  it("drops a stale parked seek (past the TTL)", () => {
    const fn = vi.fn();
    requestSeek("id-stale", 7, 1000);
    const off = onSeek("id-stale", fn, 1000 + 9000); // well past TTL
    expect(fn).not.toHaveBeenCalled();
    off();
  });

  it("unsubscribe stops further delivery", () => {
    const fn = vi.fn();
    const off = onSeek("id-gone", fn);
    off();
    requestSeek("id-gone", 99);
    expect(fn).not.toHaveBeenCalled();
  });
});
