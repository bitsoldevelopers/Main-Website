import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** Blog posts are served from the ISR cache — refresh the pages a write affects. */
function revalidatePost(slug: string) {
  revalidatePath(`/blog/${slug}`);
  revalidatePath("/blog");
  revalidatePath("/");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const post = await prisma.blog.findUnique({
      where: { slug, published: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json(post);
  } catch {
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.BLOG_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { slug } = await params;
    const body = await req.json();
    const updated = await prisma.blog.update({
      where: { slug },
      data: body,
    });

    revalidatePost(slug);
    if (updated.slug !== slug) revalidatePost(updated.slug);

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.BLOG_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { slug } = await params;
    await prisma.blog.delete({ where: { slug } });

    revalidatePost(slug);

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
