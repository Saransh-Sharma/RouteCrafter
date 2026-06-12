export function isEmbeddedImageSource(src: string): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return true;
  if (src.startsWith("/")) return true;
  if (typeof window === "undefined") return false;

  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    if (image.naturalWidth > 0) {
      await image.decode().catch(() => undefined);
      return;
    }
    throw new Error(`Could not load image: ${image.currentSrc || image.src}`);
  }

  await new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error(`Could not load image: ${image.src}`)),
      { once: true },
    );
  });
  await image.decode().catch(() => undefined);
}

async function canEmbedRemoteImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) return resolve(false);
        context.drawImage(image, 0, 0, 1, 1);
        canvas.toDataURL();
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

export async function prepareDocumentForPdf(
  root: HTMLElement,
): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;

  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map(waitForImage));

  const remoteSources = [
    ...new Set(
      images
        .map((image) => image.currentSrc || image.src)
        .filter((src) => !isEmbeddedImageSource(src)),
    ),
  ];
  const embeddable = await Promise.all(remoteSources.map(canEmbedRemoteImage));
  if (embeddable.some((value) => !value)) {
    throw new Error(
      "A remote image cannot be embedded in the downloaded PDF. Upload that image instead, or use Print / Save as PDF.",
    );
  }
}
