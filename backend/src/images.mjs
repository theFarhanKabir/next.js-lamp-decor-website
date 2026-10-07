import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "./config.mjs";
import { HttpError } from "./validation.mjs";

const allowedInputFormats = new Set(["jpeg", "png", "webp", "avif"]);
const outputWidths = [480, 960, 1600];
const maxInputPixels = 40_000_000;

export async function optimizeImage(input) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new HttpError(400, "Choose an image to upload.");
  if (input.length > config.maxImageBytes) throw new HttpError(413, "Image exceeds the upload size limit.");

  let metadata;
  try { metadata = await sharp(input, { limitInputPixels: maxInputPixels, failOn: "error" }).metadata(); }
  catch { throw new HttpError(400, "This image could not be read. Try a standard JPG, PNG, WebP, or AVIF file."); }
  if (!allowedInputFormats.has(metadata.format)) throw new HttpError(415, "Upload a JPG, PNG, WebP, or AVIF image.");
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxInputPixels) {
    throw new HttpError(413, "Image dimensions are too large to process safely.");
  }

  const longestEdge = Math.max(metadata.width, metadata.height);
  const sizes = [...new Set([...outputWidths.filter((width) => width < longestEdge), Math.min(longestEdge, outputWidths.at(-1))])].sort((a, b) => a - b);
  const variants = [];
  for (const maxEdge of sizes) {
    const { data, info } = await sharp(input, { limitInputPixels: maxInputPixels, failOn: "error" })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true, fastShrinkOnLoad: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 5, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    variants.push({ maxEdge, width: info.width, height: info.height, buffer: data, contentType: "image/webp" });
  }
  return { variants, original: { width: metadata.width, height: metadata.height, format: metadata.format } };
}

export async function uploadOptimizedImage(service, { input, folder, bucket = config.storeMediaBucket }) {
  const { variants, original } = await optimizeImage(input);
  const group = randomUUID();
  const basePath = `${folder}/${group}`;
  const stored = [];
  try {
    for (const variant of variants) {
      const path = `${basePath}/${variant.width}.webp`;
      const { error } = await service.storage.from(bucket).upload(path, variant.buffer, {
        contentType: variant.contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      const { data } = service.storage.from(bucket).getPublicUrl(path);
      stored.push({ width: variant.width, height: variant.height, url: data.publicUrl, storagePath: path, bytes: variant.buffer.length });
    }
  } catch (error) {
    if (stored.length) await service.storage.from(bucket).remove(stored.map((item) => item.storagePath));
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "The optimized image could not be saved to Supabase Storage.");
  }
  return { url: stored.at(-1).url, storagePath: stored.at(-1).storagePath, variants: stored, original };
}
