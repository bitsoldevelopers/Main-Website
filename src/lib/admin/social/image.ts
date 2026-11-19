import sharp from "sharp";

/**
 * The picture attached to a social post. It is not stored: the generated
 * image goes to the browser as a data URL for the preview and comes back
 * with the publish form, so nothing is left behind when it is discarded.
 * That keeps it well inside the 1 MB limit on a server action request.
 */

/** Added to every scene description, so the posts share one look. */
export const IMAGE_STYLE =
  "Professional editorial photograph, natural light, shallow depth of field, clean modern composition, " +
  "subtle blue accents. No text, no letters, no logos, no watermark.";

export function buildImagePrompt(description: string): string {
  const scene = description.replace(/\s+/g, " ").trim().replace(/[.\s]*$/, ".");
  return `${scene} ${IMAGE_STYLE}`;
}

const SIDE = 1080;
const QUALITY = 85;
/** Bytes, before base64. Base64 adds a third, which still leaves room for the post text in a 1 MB request. */
export const MAX_IMAGE_BYTES = 600 * 1024;

/** Any image as a JPEG of at most 1080 px a side, the size LinkedIn shows a square photo at. */
export async function toPostJpeg(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { failOn: "error" }).rotate().resize({ width: SIDE, height: SIDE, fit: "inside", withoutEnlargement: true });
  let jpeg = await image.clone().jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  if (jpeg.length > MAX_IMAGE_BYTES) jpeg = await image.clone().jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  return jpeg;
}

export function toDataUrl(jpeg: Buffer): string {
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** The image a publish form sent back, as a JPEG. Throws when it is not a usable image. */
export async function jpegFromDataUrl(value: string): Promise<Buffer> {
  const match = DATA_URL.exec(value);
  if (!match) throw new Error("The attached image could not be read. Generate it again.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES * 2) {
    throw new Error("The attached image is too large. Generate it again.");
  }
  try {
    return await toPostJpeg(bytes);
  } catch {
    throw new Error("The attached image could not be read. Generate it again.");
  }
}
