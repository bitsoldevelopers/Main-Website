import { prisma } from "@/lib/prisma";

/**
 * Serves a blog hero image stored by POST /api/blog-images. The name carries
 * a hash of the image, so the response never changes and the CDN and browsers
 * can keep it; the database is read once per image, not once per visitor.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  let image;
  try {
    image = await prisma.blogImage.findUnique({
      where: { name },
      select: { data: true },
    });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  const body = Buffer.from(image.data);
  return new Response(body, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
