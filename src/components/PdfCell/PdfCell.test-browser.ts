import { describe, it, expect } from "vitest";
import { dataUrlToBytes, bytesToDataUrl } from "./PdfCell.utils.ts";

// Runs in the browser project because PdfCell.utils statically imports the pdf.js worker via a
// Vite `?url` import, which only resolves through Vite's pipeline (not bare jsdom/node).
describe("PdfCell.utils byte helpers", () => {
  it("round-trips bytes ↔ data URL", () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 0, 99, 255]);
    const url = bytesToDataUrl(bytes);
    expect(url.startsWith("data:application/pdf;base64,")).toBe(true);
    expect(Array.from(dataUrlToBytes(url))).toEqual(Array.from(bytes));
  });
});
