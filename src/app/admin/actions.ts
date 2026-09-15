"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getBlogs() {
  try {
    const blogs = await prisma.blog.findMany({
      orderBy: { createdAt: "desc" }
    });
    return { success: true, data: blogs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createBlog(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const slug = formData.get("slug") as string;
    const author = formData.get("author") as string;
    const image = formData.get("image") as string;
    const excerpt = formData.get("excerpt") as string;
    const tags = (formData.get("tags") as string)?.split(",").map(t => t.trim()).filter(Boolean);

    if (!title || !content || !slug) {
      throw new Error("Title, content and slug are required");
    }

    const post = await prisma.blog.create({
      data: {
        title,
        content,
        slug,
        author: author || "BITSOL MARKETING",
        image: image || null,
        excerpt: excerpt || null,
        tags: tags || [],
        published: true,
      }
    });
    
    revalidatePath("/admin");
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    revalidatePath("/");
    return { success: true, data: post };
  } catch (error: any) {
    if (error.message.includes("Unique constraint")) {
      return { success: false, error: "A post with this slug already exists" };
    }
    return { success: false, error: error.message };
  }
}

export async function deleteBlog(id: string) {
  try {
    const deleted = await prisma.blog.delete({ where: { id } });
    revalidatePath("/admin");
    revalidatePath("/blog");
    revalidatePath(`/blog/${deleted.slug}`);
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
