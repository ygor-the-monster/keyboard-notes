// PDF.js setup + byte/file helpers for the PDF viewer. The worker is bundled by Vite
// via the ?url import.
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Decode a `data:` URL into the raw bytes pdf.js / pdf-lib need.
export function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function bytesToDataUrl(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:application/pdf;base64," + btoa(bin);
}
