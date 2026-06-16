// Image loading / downscaling helpers for the image editor.
const MAX_DIM = 1600;
const QUALITY = 0.85;

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Scale down to MAX_DIM and re-encode (keeps localStorage small).
export async function normalizeImage(src) {
  const img = await loadImage(src);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return c.toDataURL("image/jpeg", QUALITY);
}
