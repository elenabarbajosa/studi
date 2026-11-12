import type { Area } from "react-easy-crop";

import { AVATAR_OUTPUT_SIZE } from "@/lib/avatar";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = src;
  });
}

/**
 * Crop to a square and export as compressed WebP (fallback JPEG).
 */
export async function getCroppedAvatarBlob(
  imageSrc: string,
  pixelCrop: Area,
): Promise<{ blob: Blob; mime: "image/webp" | "image/jpeg" }> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not prepare the image canvas.");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );

  const webp = await canvasToBlob(canvas, "image/webp", 0.82);
  if (webp && webp.size > 0) {
    return { blob: webp, mime: "image/webp" };
  }

  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.85);
  if (!jpeg) {
    throw new Error("Could not compress the cropped image.");
  }
  return { blob: jpeg, mime: "image/jpeg" };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}
