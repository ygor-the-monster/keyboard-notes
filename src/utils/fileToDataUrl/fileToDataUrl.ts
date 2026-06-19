// Read a File/Blob as a base64 data URL. Shared by the media cells (image, audio, PDF).
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Approximate size in megabytes of a base64 data URL (base64 encodes 3 bytes per 4 chars, so the
// decoded payload is ~0.75× the string length). Used by the PDF and Audio cells' large-file gate.
export const dataUrlSizeMB = (dataUrl: string): number => (dataUrl.length * 0.75) / 1e6;
