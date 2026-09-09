#!/usr/bin/env node
/**
 * BITSOL MARKETING — SEO Package Publisher
 *
 * Reads the article packages in content/blog/*.md, strips the internal
 * planning blocks (SEO metadata, internal-link suggestions, image ideas,
 * schema notes, content cluster, extra SEO output), converts the article
 * body to HTML, and either previews or publishes via the blog API.
 *
 * Usage:
 *   node scripts/publish-seo-packages.mjs --dry-run
 *   node scripts/publish-seo-packages.mjs --dry-run --only best-seo-agency-pakistan
 *   node scripts/publish-seo-packages.mjs --publish
 *   node scripts/publish-seo-packages.mjs --publish --only best-seo-agency-pakistan
 *
 * --dry-run writes rendered HTML to .preview/ and prints a summary table.
 * --publish POSTs to the live blog API. Nothing is sent without it.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const p of [resolve(projectRoot, ".env"), resolve(projectRoot, ".env.local")]) {
    try {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch { /* optional */ }
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const PUBLISH = args.includes("--publish");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

if (!DRY && !PUBLISH) {
  console.error("Refusing to run without --dry-run or --publish.");
  process.exit(1);
}

// Deliberately built from the public SITE url, not NEXT_PUBLIC_API_URL —
// the latter points at the admin subdomain, which does not serve /api/blog.
const apiIdx = args.indexOf("--api");
const API_URL = apiIdx !== -1
  ? args[apiIdx + 1]
  : `${(process.env.NEXT_PUBLIC_SITE_URL || "https://bitsolmarketing.com").replace(/\/$/, "")}/api/blog`;
const API_KEY = process.env.BLOG_API_KEY;

// ─── Section boundaries ──────────────────────────────────────────────────────
// Everything from "## H1:" up to (not including) the first internal block.
const INTERNAL_BLOCKS = [
  "## Suggested Internal Links",
  "## Image Suggestions",
  "## Schema Recommendation",
  "## CONTENT CLUSTER",
  "## EXTRA SEO OUTPUT",
];

function extractArticle(raw) {
  const startIdx = raw.indexOf("## H1:");
  if (startIdx === -1) return null;

  let endIdx = raw.length;
  for (const marker of INTERNAL_BLOCKS) {
    const i = raw.indexOf(marker, startIdx);
    if (i !== -1 && i < endIdx) endIdx = i;
  }

  let body = raw.slice(startIdx, endIdx).trim();

  // Drop the "## H1: ..." line itself — the page renders post.title separately.
  const nl = body.indexOf("\n");
  const h1Line = body.slice(0, nl).trim();
  body = body.slice(nl + 1).trim();

  // Trim a trailing horizontal rule left behind by the cut.
  body = body.replace(/\n---\s*$/, "").trim();

  const title = h1Line.replace(/^## H1:\s*/, "").trim();
  return { title, body };
}

// ─── Metadata: handles both the table format and the bold-line format ────────
function metaField(raw, label) {
  // Bold-line: **SEO Title:** value
  const bold = raw.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`));
  if (bold) return bold[1].trim();
  // Table row: | **SEO Title** | value |
  const table = raw.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|]+)\\|`));
  if (table) return table[1].trim();
  return null;
}

function deriveTags(raw, slug) {
  const tags = new Set();
  const kw = metaField(raw, "Primary Keyword");
  const s = `${slug} ${kw || ""}`.toLowerCase();
  if (/whatsapp/.test(s)) tags.add("WhatsApp Automation");
  if (/\bseo\b|search|maps/.test(s)) tags.add("SEO");
  if (/\bai\b|automation|agent/.test(s)) tags.add("AI Marketing");
  if (/ads|ppc|meta|facebook|google ads/.test(s)) tags.add("Paid Advertising");
  if (/lead/.test(s)) tags.add("Lead Generation");
  if (/develop|software|saas|crm|website|ecommerce/.test(s)) tags.add("Development");
  if (/digital marketing/.test(s)) tags.add("Digital Marketing");
  tags.add("Pakistan");
  return [...tags].slice(0, 5);
}

function firstParagraph(body) {
  for (const line of body.split("\n")) {
    const t = line.trim().replace(/\*\*/g, "").replace(/\[(.+?)\]\(.+?\)/g, "$1");
    if (t && !t.startsWith("#") && !t.startsWith("---") && !t.startsWith("|") && t.length > 60) {
      return t.length > 200 ? t.slice(0, 197) + "…" : t;
    }
  }
  return null;
}

// ─── Markdown → HTML ─────────────────────────────────────────────────────────
function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let inUl = false, inOl = false, inTable = false;
  let tableLines = [];
  let para = [];

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+?)\*/g, "$1<em>$2</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
  };
  const flushList = () => {
    flushPara();
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const flushTable = () => {
    if (!inTable || !tableLines.length) { inTable = false; tableLines = []; return; }
    inTable = false;
    const rows = tableLines.filter((l) => l.startsWith("|"));
    const parseRow = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
    if (rows.length < 2) { tableLines = []; return; }
    const headers = parseRow(rows[0]);
    let t = '<div class="table-wrap"><table><thead><tr>';
    headers.forEach((h) => (t += `<th>${inline(h)}</th>`));
    t += "</tr></thead><tbody>";
    rows.slice(2).forEach((row) => {
      t += "<tr>";
      parseRow(row).forEach((c) => (t += `<td>${inline(c)}</td>`));
      t += "</tr>";
    });
    out.push(t + "</tbody></table></div>");
    tableLines = [];
  };

  for (const line of lines) {
    const tr = line.trim();

    if (tr.startsWith("|")) { flushList(); inTable = true; tableLines.push(tr); continue; }
    if (inTable) flushTable();

    if (/^#{1,4} /.test(tr)) {
      flushList();
      const lvl = tr.match(/^(#{1,4})/)[1].length;
      out.push(`<h${lvl}>${inline(tr.replace(/^#{1,4} /, ""))}</h${lvl}>`);
      continue;
    }
    if (tr === "---" || tr === "***") { flushList(); out.push("<hr/>"); continue; }
    if (/^[-*] /.test(tr)) {
      flushPara();
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(tr.replace(/^[-*] /, ""))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(tr)) {
      flushPara();
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(tr.replace(/^\d+\. /, ""))}</li>`);
      continue;
    }
    if (tr.startsWith("> ")) { flushList(); out.push(`<blockquote>${inline(tr.slice(2))}</blockquote>`); continue; }
    if (tr === "") { flushList(); continue; }
    para.push(tr);
  }
  flushTable();
  flushList();
  return out.join("\n");
}

// ─── Build payloads ──────────────────────────────────────────────────────────
const blogDir = resolve(projectRoot, "content/blog");
let files = readdirSync(blogDir).filter((f) => f.endsWith(".md"));
if (ONLY) files = files.filter((f) => basename(f, ".md") === ONLY);

if (!files.length) {
  console.error("No matching packages found.");
  process.exit(1);
}

const payloads = [];
const problems = [];

for (const file of files.sort()) {
  const raw = readFileSync(resolve(blogDir, file), "utf8");
  const article = extractArticle(raw);
  if (!article) { problems.push(`${file}: no "## H1:" heading found`); continue; }

  const slug = metaField(raw, "URL Slug") || basename(file, ".md");
  const metaDescription = metaField(raw, "Meta Description");
  const seoTitle = metaField(raw, "SEO Title");
  const content = mdToHtml(article.body);
  const excerpt = firstParagraph(article.body);

  if (!metaDescription) problems.push(`${file}: missing meta description`);
  if (!excerpt) problems.push(`${file}: could not derive excerpt`);
  if (/SEO METADATA|Suggested Internal Links|Image Suggestions|Schema Recommendation/i.test(content)) {
    problems.push(`${file}: internal planning block leaked into content`);
  }

  payloads.push({
    file,
    slug,
    title: article.title,
    seoTitle,
    content,
    excerpt,
    metaDescription,
    tags: deriveTags(raw, slug),
    author: "BITSOL MARKETING",
    words: article.body.split(/\s+/).length,
    bytes: content.length,
  });
}

// ─── Dry run ─────────────────────────────────────────────────────────────────
if (DRY) {
  const previewDir = resolve(projectRoot, ".preview");
  mkdirSync(previewDir, { recursive: true });
  for (const p of payloads) {
    writeFileSync(
      resolve(previewDir, `${p.slug}.html`),
      `<!doctype html><meta charset="utf-8"><title>${p.title}</title>` +
      `<style>body{font:16px/1.65 system-ui;max-width:760px;margin:40px auto;padding:0 20px}` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}` +
      `.table-wrap{overflow-x:auto}</style>` +
      `<h1>${p.title}</h1>\n${p.content}`,
      "utf8"
    );
  }
  console.log(`\nDRY RUN — ${payloads.length} package(s), nothing sent.\n`);
  console.log("slug".padEnd(52) + "words".padStart(6) + "  html".padStart(8) + "  tags");
  console.log("-".repeat(100));
  for (const p of payloads) {
    console.log(p.slug.padEnd(52) + String(p.words).padStart(6) + String(p.bytes).padStart(8) + "  " + p.tags.join(", "));
  }
  console.log(`\nRendered HTML written to .preview/`);
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`);
    problems.forEach((x) => console.log("  - " + x));
  } else {
    console.log("\nNo problems detected.");
  }
  process.exit(problems.length ? 2 : 0);
}

// ─── Publish ─────────────────────────────────────────────────────────────────
if (!API_KEY) {
  console.error("BLOG_API_KEY is not set. Refusing to publish.");
  process.exit(1);
}

console.log(`\nPublishing ${payloads.length} article(s) to ${API_URL}\n`);
let ok = 0, failed = 0;

for (const p of payloads) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        title: p.title,
        content: p.content,
        slug: p.slug,
        author: p.author,
        excerpt: p.excerpt,
        metaDescription: p.metaDescription,
        tags: p.tags,
      }),
    });
    if (res.ok) { console.log(`  ok      ${p.slug}`); ok++; }
    else { console.log(`  FAILED  ${p.slug} — ${res.status} ${(await res.text()).slice(0, 120)}`); failed++; }
  } catch (e) {
    console.log(`  ERROR   ${p.slug} — ${e.message}`);
    failed++;
  }
}

console.log(`\nDone. ${ok} published, ${failed} failed.`);
