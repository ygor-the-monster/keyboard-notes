// QR encode + camera-scan for Local Beam. Both libraries are dynamically imported so they (and the
// camera path) stay out of the main bundle — loaded only when the Beam screen opens, like abcjs/pdfjs.
// Decode prefers the native BarcodeDetector (Chromium); falls back to jsQR (iOS Safari, Firefox).

// Render `text` as a QR onto the canvas. Error-correction "L" maximizes capacity for our SDP blobs.
export async function encodeQr(text: string, canvas: HTMLCanvasElement, size = 320): Promise<void> {
  const QR = (await import("qrcode")).default;
  await QR.toCanvas(canvas, text, { errorCorrectionLevel: "L", margin: 2, width: size });
}

export interface QrScanner {
  stop: () => void;
}

// Minimal shape of the native BarcodeDetector (not in TS's DOM lib).
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
}

// Open the rear camera into `video` and scan for a QR. Calls `onResult` once with the decoded text
// (then stops scanning; the caller still calls `stop()` to release the camera). `onError` fires if
// the camera can't be opened.
export async function scanQr(
  video: HTMLVideoElement,
  onResult: (text: string) => void,
  onError: (err: Error) => void,
): Promise<QrScanner> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
  } catch (err) {
    onError(err as Error);
    return { stop: () => {} };
  }

  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
  };

  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  try {
    await video.play();
  } catch {
    /* autoplay quirks — frames still arrive */
  }

  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  let detector: BarcodeDetectorLike | null = null;
  if (Ctor) {
    try {
      detector = new Ctor({ formats: ["qr_code"] });
    } catch {
      detector = null;
    }
  }
  const jsQR = detector ? null : (await import("jsqr")).default;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tick = async () => {
    if (stopped) return;
    try {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) return onResult(codes[0].rawValue);
      } else if (jsQR && ctx && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(img.data, img.width, img.height);
        if (found?.data) return onResult(found.data);
      }
    } catch {
      /* transient decode/detect error — keep scanning */
    }
    if (!stopped) requestAnimationFrame(() => void tick());
  };
  requestAnimationFrame(() => void tick());

  return { stop };
}
