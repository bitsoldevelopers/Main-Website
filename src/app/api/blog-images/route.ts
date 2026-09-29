import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 1600;

/**
 * Stores a blog hero image and returns its public URL. Called by
 * scripts/daily-content-automation.mjs and authenticated like /api/blog.
 *
 *   POST /api/blog-images?name=<post-slug>     body: the image bytes
 *
 * The stored name ends in a hash of the image, so a URL never changes what it
 * shows and can be cached for good.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.BLOG_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = (new URL(req.url).searchParams.get("name") ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!base) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const upload = Buffer.from(await req.arrayBuffer());
  if (upload.length === 0) {
    return NextResponse.json({ error: "The request has no image" }, { status: 400 });
  }
  if (upload.length > MAX_BYTES) {
    return NextResponse.json({ error: "The image is larger than 8 MB" }, { status: 413 });
  }

  let data: Uint8Array<ArrayBuffer>;
  let width: number;
  let height: number;
  try {
    const encoded = await sharp(upload, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    data = new Uint8Array(encoded.data);
    width = encoded.info.width;
    height = encoded.info.height;
  } catch {
    return NextResponse.json({ error: "The upload is not a readable image" }, { status: 415 });
  }

  const hash = createHash("sha256").update(data).digest("hex").slice(0, 10);
  const name = `${base}-${hash}.webp`;

  try {
    await prisma.blogImage.upsert({
      where: { name },
      update: {},
      create: { name, data, width, height },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to store the image";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ url: `${SITE_URL}/blog-images/${name}`, width, height }, { status: 201 });
}
