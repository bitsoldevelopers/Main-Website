import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { slugify } from "@/lib/admin/slug";

const MAX_BYTES = 15 * 1024 * 1024;

/** MIME allowlist and the extension each type is stored with. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

/** Raster formats that get rotated, capped at 2560px and re-encoded. */
const OPTIMIZABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Media library uploads. Files land in public/uploads/<year>/<month>/ (the
 * standalone server serves /public at request time, so new files are live
 * immediately) and each gets a Media row that the admin manages.
 */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdminAction("media.write");
  } catch (err) {
    const forbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: forbidden ? "Forbidden" : "Unauthorized" }, { status: forbidden ? 403 : 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file in the upload" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: `File type ${file.type || "unknown"} is not allowed` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "The file is larger than 15 MB" }, { status: 413 });
  }

  const alt = typeof form.get("alt") === "string" ? (form.get("alt") as string).trim().slice(0, 191) : "";

  let buffer = Buffer.from(await file.arrayBuffer());
  let width: number | null = null;
  let height: number | null = null;

  if (OPTIMIZABLE.has(file.type)) {
    try {
      const image = sharp(buffer, { failOn: "error" }).rotate();
      const meta = await image.metadata();
      const resized = meta.width && meta.width > 2560 ? image.resize({ width: 2560 }) : image;
      buffer =
        file.type === "image/png"
          ? await resized.png().toBuffer()
          : file.type === "image/webp"
            ? await resized.webp({ quality: 85 }).toBuffer()
            : await resized.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      const finalMeta = await sharp(buffer).metadata();
      width = finalMeta.width ?? null;
      height = finalMeta.height ?? null;
    } catch {
      return NextResponse.json({ error: "That image could not be processed — is the file corrupt?" }, { status: 422 });
    }
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const base = slugify(path.basename(file.name, path.extname(file.name))).slice(0, 80) || "file";
  const filename = `${base}-${now.getTime().toString(36)}${ext}`;
  const publicPath = `/uploads/${year}/${month}/${filename}`;

  const dir = path.join(process.cwd(), "public", "uploads", year, month);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
  } catch (err) {
    console.error("Media upload failed to write file:", err);
    return NextResponse.json({ error: "Could not store the file on the server" }, { status: 500 });
  }

  try {
    const media = await prisma.media.create({
      data: {
        filename: file.name.slice(0, 191),
        path: publicPath,
        mime: file.type,
        size: buffer.byteLength,
        width,
        height,
        alt: alt || null,
      },
    });
    void logActivity({ actor: actorLabel(session), action: "media.uploaded", entity: "media", entityId: media.id, detail: `${file.name} → ${publicPath}` });
    return NextResponse.json({ ok: true, media }, { status: 201 });
  } catch (err) {
    console.error("Media upload failed to record row:", err);
    return NextResponse.json({ error: "Stored the file but could not record it in the database" }, { status: 500 });
  }
}
