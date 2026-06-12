/** Max edge (px) for compressed uploads; keeps localStorage footprint small. */
const MAX_EDGE = 1200;
const MIN_EDGE = 480;
const START_QUALITY = 0.78;
const MIN_QUALITY = 0.45;
const TARGET_DATA_URL_CHARS = 400 * 1024;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Read an uploaded image file, downscale it to fit within MAX_EDGE, and return
 * a compressed JPEG data URL. Data URLs embed reliably in the html2pdf export
 * (no cross-origin canvas tainting) and survive localStorage persistence.
 */
export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Images must be 8 MB or smaller before compression.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let edge = Math.min(MAX_EDGE, Math.max(img.width, img.height));
  let quality = START_QUALITY;
  let compressed = dataUrl;

  while (edge >= MIN_EDGE) {
    compressed = renderJpeg(img, edge, quality);
    if (compressed.length <= TARGET_DATA_URL_CHARS) return compressed;

    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
    } else {
      edge = Math.floor(edge * 0.82);
      quality = START_QUALITY;
    }
  }

  throw new Error(
    "This image could not be compressed below 400 KB. Choose a smaller or simpler image.",
  );
}

function renderJpeg(
  img: HTMLImageElement,
  maxEdge: number,
  quality: number,
): string {
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image compression is unavailable in this browser.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}
