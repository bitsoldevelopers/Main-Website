"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, FileText, Film, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteMedia, updateMediaAlt } from "@/app/admin/actions-cms";
import { formatDate } from "@/lib/admin/format";
import { btn, inputClass } from "./ui";
import { ConfirmButton, SubmitButton } from "./SubmitButton";

export interface MediaItem {
  id: string;
  filename: string;
  path: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: string;
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CopyUrlButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btn.ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(path);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Copy the URL:", path);
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : "Copy URL"}
    </button>
  );
}

export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/admin/media", { method: "POST", body });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          failures.push(`${file.name}: ${payload?.error ?? `upload failed (${res.status})`}`);
        }
      } catch {
        failures.push(`${file.name}: network error`);
      }
    }
    setBusy(false);
    if (failures.length) setError(failures.join(" · "));
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        disabled={busy}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-sm transition",
          dragOver ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-900",
          busy && "pointer-events-none opacity-60"
        )}
      >
        {busy ? <Loader2 className="h-6 w-6 animate-spin text-cyan-700" /> : <UploadCloud className="h-6 w-6" />}
        <span className="font-semibold">{busy ? "Uploading…" : "Drop files here or click to upload"}</span>
        <span className="text-xs text-slate-500">JPG, PNG, WebP, GIF, SVG, MP4, PDF, DOCX — up to 15 MB. Large images are resized and compressed.</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,application/pdf,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const isImage = item.mime.startsWith("image/");
        const isVideo = item.mime.startsWith("video/");
        return (
          <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <a
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-40 place-items-center overflow-hidden border-b border-slate-200 bg-slate-100"
            >
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of arbitrary runtime uploads
                <img src={item.path} alt={item.alt ?? item.filename} loading="lazy" className="h-full w-full object-cover" />
              ) : isVideo ? (
                <Film className="h-10 w-10 text-slate-500" />
              ) : (
                <FileText className="h-10 w-10 text-slate-500" />
              )}
            </a>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="truncate text-sm font-semibold text-slate-900" title={item.filename}>
                {item.filename}
              </p>
              <p className="text-xs text-slate-500">
                {prettySize(item.size)}
                {item.width && item.height ? ` · ${item.width}×${item.height}` : ""} · {formatDate(item.createdAt)}
              </p>
              <form action={updateMediaAlt} className="flex gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="alt"
                  defaultValue={item.alt ?? ""}
                  placeholder="Alt text"
                  aria-label="Alt text"
                  className={cn(inputClass, "px-3 py-1.5 text-xs")}
                />
                <SubmitButton variant="secondary" className="px-3 py-1.5 text-xs" pendingText="…">
                  Save
                </SubmitButton>
              </form>
              <div className="mt-auto flex items-center justify-between pt-1">
                <CopyUrlButton path={item.path} />
                <form action={deleteMedia}>
                  <input type="hidden" name="id" value={item.id} />
                  <ConfirmButton message={`Delete ${item.filename}? Pages using it will show a broken link.`} variant="icon" className="hover:text-red-600">
                    ✕
                  </ConfirmButton>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
