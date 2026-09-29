#!/usr/bin/env node
/**
 * BITSOL MARKETING — Seed a local database from the live blog
 *
 * Copies every published article from https://bitsolmarketing.com/api/blog
 * into the database named by DATABASE_URL, so the admin panel and the blog
 * pages have real content on a dev machine. Existing slugs are skipped, so
 * it is safe to re-run.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="mysql://root@localhost:3306/bitsol_next"; node scripts/seed-local-from-live.mjs
 * Usage (bash):
 *   DATABASE_URL="mysql://root@localhost:3306/bitsol_next" node scripts/seed-local-from-live.mjs
 *
 * Optional: --file <path.json> to seed from a saved API response instead of fetching.
 */

import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const LIVE_API = "https://bitsolmarketing.com/api/blog?limit=400&full=1";
const BATCH = 25;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Point it at the LOCAL database you want to fill.");
  process.exit(1);
}
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to seed a non-local database:", url.replace(/:[^:@/]+@/, ":***@"));
  process.exit(1);
}

async function loadPosts() {
  const file = arg("file");
  if (file) {
    console.log(`Reading ${file}`);
    return JSON.parse(readFileSync(file, "utf8"));
  }
  console.log(`Fetching ${LIVE_API}`);
  const res = await fetch(LIVE_API);
  if (!res.ok) throw new Error(`Live API responded ${res.status}`);
  return res.json();
}

const prisma = new PrismaClient();

try {
  const posts = await loadPosts();
  if (!Array.isArray(posts)) throw new Error("Unexpected API response shape");
  console.log(`${posts.length} published posts on the live site`);

  let inserted = 0;
  for (let i = 0; i < posts.length; i += BATCH) {
    const chunk = posts.slice(i, i + BATCH).map((p) => ({
      title: p.title,
      slug: p.slug,
      content: p.content ?? "",
      author: p.author || "BITSOL MARKETING",
      image: p.image ?? null,
      excerpt: p.excerpt ?? null,
      metaDescription: p.metaDescription ?? null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      published: true,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    }));
    const result = await prisma.blog.createMany({ data: chunk, skipDuplicates: true });
    inserted += result.count;
    process.stdout.write(`\r  inserted ${inserted} (skipped ${i + chunk.length - inserted} existing)`);
  }
  process.stdout.write("\n");

  const total = await prisma.blog.count();
  console.log(`Done. Blog table now holds ${total} posts.`);
} finally {
  await prisma.$disconnect();
}
