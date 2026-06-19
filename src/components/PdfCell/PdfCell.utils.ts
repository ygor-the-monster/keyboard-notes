// PDF.js byte/file helpers for the PDF viewer. pdf.js (and its worker) are large, so the library
// is loaded lazily — only when a PDF cell actually opens a document. The worker URL is bundled by
// Vite via the ?url import (just a string, so it stays a static import). oxlint analyses the raw
// .mjs (which has no default) and false-positives, so silence that one rule here.
// eslint-disable-next-line import/default
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let _pdfjs: typeof import("pdfjs-dist") | null = null;
export async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (_pdfjs) return _pdfjs;
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = workerUrl;
  _pdfjs = lib;
  return lib;
}

export { fileToDataUrl, dataUrlSizeMB } from "../../utils/fileToDataUrl/fileToDataUrl.ts";

// Decode a `data:` URL into the raw bytes pdf.js / pdf-lib need.
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:application/pdf;base64," + btoa(bin);
}
