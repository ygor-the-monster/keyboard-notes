import { describe, it, expect } from "vitest";
import { fingerprintOf, safetyCode, formatSafetyCode } from "./safetyCode.ts";

const sdp = (fp: string) =>
  `v=0\r\na=group:BUNDLE 0\r\na=fingerprint:sha-256 ${fp}\r\na=setup:actpass\r\n`;
const FP_A = "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89";
const FP_B = "11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00";

describe("fingerprintOf", () => {
  it("extracts the fingerprint hex, colons stripped, upper-cased", () => {
    expect(fingerprintOf(sdp("ab:cd:ef"))).toBe("ABCDEF");
  });
  it("returns null when no fingerprint line is present", () => {
    expect(fingerprintOf("v=0\r\na=setup:actpass\r\n")).toBeNull();
  });
});

describe("safetyCode", () => {
  it("is a 6-digit string", () => {
    expect(safetyCode(sdp(FP_A), sdp(FP_B))).toMatch(/^\d{6}$/);
  });

  it("is order-independent (both peers compute the same code)", () => {
    expect(safetyCode(sdp(FP_A), sdp(FP_B))).toBe(safetyCode(sdp(FP_B), sdp(FP_A)));
  });

  it("changes when a fingerprint changes (a swapped QR is caught)", () => {
    const FP_C = "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:01";
    expect(safetyCode(sdp(FP_A), sdp(FP_B))).not.toBe(safetyCode(sdp(FP_A), sdp(FP_C)));
  });

  it("is null until both fingerprints are present", () => {
    expect(safetyCode(sdp(FP_A), "v=0\r\n")).toBeNull();
  });
});

describe("formatSafetyCode", () => {
  it("groups six digits as '123 456'", () => {
    expect(formatSafetyCode("123456")).toBe("123 456");
  });
});
