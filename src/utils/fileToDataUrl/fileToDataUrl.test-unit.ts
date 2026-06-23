import { describe, it, expect } from "vitest";
import { fileToDataUrl, dataUrlSizeMB } from "./fileToDataUrl.ts";

describe("fileToDataUrl", () => {
  it("reads a Blob as a base64 data URL", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    const url = await fileToDataUrl(blob);
    expect(url).toMatch(/^data:text\/plain;base64,/);
    // "hello" base64 → "aGVsbG8="
    expect(url.endsWith("aGVsbG8=")).toBe(true);
  });
});

describe("dataUrlSizeMB", () => {
  it("approximates decoded payload size at ~0.75x the string length", () => {
    const oneMbString = "x".repeat(1_000_000);
    expect(dataUrlSizeMB(oneMbString)).toBeCloseTo(0.75, 5);
  });

  it("is zero for an empty string", () => {
    expect(dataUrlSizeMB("")).toBe(0);
  });
});
