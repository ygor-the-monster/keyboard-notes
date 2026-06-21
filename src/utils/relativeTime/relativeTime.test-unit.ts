import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./relativeTime.ts";

const NOW = 1_700_000_000_000;
const ago = (ms: number) => formatRelativeTime(NOW - ms, NOW, "en");

describe("formatRelativeTime", () => {
  it("renders recent times in seconds/minutes", () => {
    expect(ago(5_000)).toBe("5 seconds ago");
    expect(ago(90_000)).toBe("1 minute ago");
  });

  it("renders hours and days", () => {
    expect(ago(3 * 3600_000)).toBe("3 hours ago");
    expect(ago(2 * 86_400_000)).toBe("2 days ago");
  });

  it("renders weeks and years for older times (numeric:auto phrasing)", () => {
    expect(ago(3 * 7 * 86_400_000)).toBe("3 weeks ago");
    expect(ago(400 * 86_400_000)).toBe("last year");
  });

  it("honors the locale", () => {
    // German for "yesterday" via numeric:auto.
    expect(formatRelativeTime(NOW - 86_400_000, NOW, "de")).toBe("gestern");
  });
});
