/**
 * Backlink checker.
 *
 * Reads content/backlinks/targets.json and reports, for each URL, whether the
 * page links to bitsolmarketing.com, mentions the brand without linking, or
 * can't be read. Run it after every submission round to see what actually
 * went live:
 *
 *   node scripts/check-backlinks.mjs
 *   node scripts/check-backlinks.mjs --json > report.json
 *
 * Nothing here submits anything. It only looks at public pages.
 */

import fs from "node:fs";
import path from "node:path";

const DOMAIN = "bitsolmarketing.com";
const TARGETS = path.join(process.cwd(), "content", "backlinks", "targets.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const asJson = process.argv.includes("--json");

/** Classifies one page's relationship to the site. */
async function check(target) {
  const row = { ...target, status: null, link: "none", rel: null, note: "" };
  try {
    const res = await fetch(target.url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    row.status = res.status;

    if (!res.ok) {
      row.note = res.status === 403 ? "blocked to scripts — check in a browser" : "not reachable";
      return row;
    }

    const html = await res.text();
    const anchors = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi)];
    const hit = anchors.find((m) => m[1].includes(DOMAIN));

    if (hit) {
      row.link = /rel="[^"]*nofollow/i.test(hit[0]) ? "nofollow" : "follow";
      row.rel = (hit[0].match(/rel="([^"]+)"/i) || [])[1] ?? null;
    } else if (new RegExp(DOMAIN, "i").test(html)) {
      row.link = "url-unlinked";
      row.note = "URL appears as plain text — ask for it to be linked";
    } else if (/bitsol/i.test(html)) {
      row.link = "mention";
      row.note = "brand mentioned without the URL — reclaim this one";
    }
  } catch (error) {
    row.note = error.name === "TimeoutError" ? "timed out" : error.message.slice(0, 60);
  }
  return row;
}

const targets = JSON.parse(fs.readFileSync(TARGETS, "utf8"));
const rows = [];
for (const target of targets) {
  rows.push(await check(target));
}

if (asJson) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2));
} else {
  const label = { follow: "LINKED", nofollow: "linked (nofollow)", "url-unlinked": "url, no link", mention: "mention only", none: "-" };
  console.log(`${"site".padEnd(26)} ${"status".padEnd(7)} ${"link".padEnd(18)} note`);
  for (const r of rows) {
    console.log(`${r.name.padEnd(26)} ${String(r.status ?? "-").padEnd(7)} ${label[r.link].padEnd(18)} ${r.note}`);
  }
  const live = rows.filter((r) => r.link === "follow" || r.link === "nofollow").length;
  console.log(`\n${live} of ${rows.length} targets currently link to ${DOMAIN}.`);
}
