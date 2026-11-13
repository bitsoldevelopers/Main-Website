#!/usr/bin/env node
/**
 * =============================================================================
 *  Prospect list builder — public business listings → importable CSV
 * =============================================================================
 *
 *  Finds businesses in the target industries and countries that publish their
 *  own contact email, and writes CSV files in the Lead Automation import
 *  format (Admin → Lead Automation → Sources → CSV).
 *
 *  Where addresses come from, and nothing else:
 *    1. OpenStreetMap (open data, ODbL): the business's own `email` tag.
 *    2. For businesses that list only a website (Pakistan and UAE): the email
 *       shown on that website's home, contact or about page. robots.txt is
 *       respected, at most 3 pages per site, one request at a time per site.
 *
 *  Every address is checked: valid syntax, not a placeholder or no-reply
 *  address, not a government / NHS / state-school domain, and the domain has
 *  a mail server (MX). One lead per business; one business per domain.
 *  Brand chains (OSM `brand:wikidata`) are left out: their branch addresses
 *  are customer service desks, not buyers. In the UK only company-domain
 *  addresses are kept (no Gmail/Hotmail), which leaves out most sole traders.
 *
 *  Usage:
 *    node scripts/find-leads.mjs [--out <dir>] [--target 10000] [--countries PK,AE,GB]
 *
 *  Output (default ../leads next to the repo, never inside it — the files hold
 *  contact data and must not be committed):
 *    leads-PK.csv, leads-AE.csv, leads-UK.csv   one file per market to import
 *    summary.json                               counts per market and industry
 *    cache/                                     OSM downloads and site crawls,
 *                                               so a re-run is quick
 * =============================================================================
 */

import { promises as dnsPromises } from "node:dns";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Options ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(opt("out", path.join(repoRoot, "..", "leads")));
const TARGET = Number.parseInt(opt("target", "10000"), 10);
const COUNTRIES = opt("countries", "PK,AE,GB").split(",").map((c) => c.trim().toUpperCase());
const CACHE = path.join(OUT, "cache");

// Websites: a browser-compatible name, or many refuse the request.
const USER_AGENT = "Mozilla/5.0 (compatible; lead-finder/1.0; +public-business-listings)";
// Overpass refuses (406) a client that presents itself as a browser.
const OSM_USER_AGENT = "lead-finder/1.0 (public business listings)";
// Public Overpass servers, tried in turn: the main one is often "at capacity".
const OVERPASS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const COUNTRY_NAME = { PK: "Pakistan", AE: "United Arab Emirates", GB: "United Kingdom" };
const FILE_CODE = { PK: "PK", AE: "AE", GB: "UK" };

const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Industries: OSM selectors and labels ───────────────────────────────────

const SHOP_TYPES = [
  "clothes", "boutique", "beauty", "hairdresser", "cosmetics", "jewelry", "furniture", "electronics", "mobile_phone",
  "shoes", "gift", "bakery", "florist", "interior_decoration", "perfumery", "bag", "watches", "sports", "optician",
  "fabric", "tailor", "toys", "books", "pet", "garden_centre", "kitchen", "bed", "lighting", "computer", "confectionery",
];

/** [industry, OSM selector, human label]. `local` selectors are skipped in the UK (mostly public sector or sole traders). */
const SELECTORS = [
  ["real_estate", '["office"="estate_agent"]', "Real estate agency"],
  ["real_estate", '["shop"="estate_agent"]', "Real estate agency"],
  ["real_estate", '["office"="property_management"]', "Property management company"],
  ["real_estate", '["office"="construction_company"]', "Construction company"],
  ["real_estate", '["office"="company"]["name"~"real estate|propert|estate|builder|developer|realty|construction",i]', "Real estate company", "local"],
  ["real_estate", '["craft"="builder"]', "Builder", "local"],
  ["health", '["amenity"="dentist"]', "Dental clinic"],
  ["health", '["amenity"="clinic"]', "Clinic"],
  ["health", '["healthcare"~"^(clinic|dentist|laboratory|physiotherapist|optometrist|psychotherapist|alternative|centre|rehabilitation)$"]', "Healthcare practice"],
  ["health", '["amenity"="doctors"]', "Medical practice", "local"],
  ["health", '["amenity"="hospital"]', "Hospital", "local"],
  ["education", '["amenity"~"^(language_school|driving_school|music_school|dancing_school|training|prep_school)$"]', "Training institute"],
  ["education", '["office"="educational_institution"]', "Educational institute"],
  ["education", '["amenity"~"^(school|college|kindergarten)$"]', "School", "local"],
  ["education", '["amenity"="university"]', "University", "local"],
  ["hospitality", '["amenity"~"^(restaurant|cafe|fast_food|ice_cream)$"]', "Restaurant"],
  ["hospitality", '["tourism"~"^(hotel|guest_house|motel|hostel|apartment)$"]', "Hotel"],
  ["hospitality", `["shop"~"^(${SHOP_TYPES.join("|")})$"]`, "Shop"],
];

const INDUSTRY_LABEL = { real_estate: "Real estate & builders", health: "Clinics & healthcare", education: "Schools & training", hospitality: "Hospitality & retail" };
const INDUSTRIES = Object.keys(INDUSTRY_LABEL);

const VALUE_LABEL = {
  dentist: "Dental clinic", clinic: "Clinic", doctors: "Medical practice", hospital: "Hospital", laboratory: "Medical laboratory",
  physiotherapist: "Physiotherapy clinic", optometrist: "Optometrist", optician: "Optician", school: "School", college: "College",
  university: "University", kindergarten: "Nursery school", language_school: "Language school", driving_school: "Driving school",
  music_school: "Music school", dancing_school: "Dance school", training: "Training institute", prep_school: "Tutoring centre",
  restaurant: "Restaurant", cafe: "Café", fast_food: "Fast-food restaurant", ice_cream: "Ice-cream parlour", hotel: "Hotel",
  guest_house: "Guest house", motel: "Motel", hostel: "Hostel", apartment: "Serviced apartments", estate_agent: "Real estate agency",
  property_management: "Property management company", construction_company: "Construction company", builder: "Builder",
  beauty: "Beauty salon", hairdresser: "Hair salon", clothes: "Clothing store", boutique: "Boutique", jewelry: "Jewellery store",
  furniture: "Furniture store", electronics: "Electronics store", mobile_phone: "Mobile phone store", bakery: "Bakery", florist: "Florist",
};

function describe(tags, fallback) {
  for (const key of ["healthcare", "amenity", "office", "tourism", "shop", "craft"]) {
    const label = VALUE_LABEL[tags[key]];
    if (label) return label;
  }
  if (tags.shop) return `${tags.shop.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} store`;
  return fallback;
}

// ─── OpenStreetMap ──────────────────────────────────────────────────────────

function selectorsFor(cc, industry) {
  return SELECTORS.filter(([ind, , , scope]) => ind === industry && !(cc === "GB" && scope === "local")).map(([, selector]) => selector);
}

/**
 * The queries one industry is fetched with. A small country is one query per
 * industry. The UK is one query per selector, and the long shop list goes in
 * groups of six: the public servers time out on a single UK-wide query.
 */
function queryParts(cc, industry) {
  const selectors = selectorsFor(cc, industry);
  if (cc !== "GB") return [selectors];
  const parts = [];
  for (const selector of selectors) {
    if (!selector.startsWith('["shop"~')) {
      parts.push([selector]);
      continue;
    }
    for (let i = 0; i < SHOP_TYPES.length; i += 6) parts.push([`["shop"~"^(${SHOP_TYPES.slice(i, i + 6).join("|")})$"]`]);
  }
  return parts;
}

function overpassQuery(cc, selectors) {
  const contact = cc === "GB" ? '[~"^(contact:)?email$"~"."]' : '[~"^(contact:)?(email|website)$"~"."]';
  const parts = selectors.map((selector) => `nwr(area.a)${selector}["name"]${contact};`);
  return `[out:json][timeout:900][maxsize:1073741824];area["ISO3166-1"="${cc}"][admin_level=2]->.a;(${parts.join("")});out tags center;`;
}

async function fetchOverpass(query, label) {
  for (let attempt = 0; attempt < 18; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": OSM_USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(960_000),
      });
      const text = await res.text();
      if (res.ok && text.trimStart().startsWith("{")) {
        const json = JSON.parse(text);
        if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) throw new Error(json.remark);
        return json.elements ?? [];
      }
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120).replace(/\s+/g, " ")}`);
    } catch (err) {
      // A full server frees up within minutes; the next mirror is tried right away.
      const wait = attempt % OVERPASS.length === OVERPASS.length - 1 ? Math.min(180_000, 20_000 * 2 ** Math.floor(attempt / OVERPASS.length)) : 2_000;
      log(`  OSM ${label}: ${url.split("/")[2]} failed (${err.message ?? err}); retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw new Error(`OpenStreetMap query for ${label} failed after retries`);
}

async function osmElements(cc, industry) {
  const file = path.join(CACHE, `osm-${cc}-${industry}.json`);
  if (existsSync(file)) return JSON.parse(await readFile(file, "utf8"));
  log(`OSM: downloading ${COUNTRY_NAME[cc]} / ${INDUSTRY_LABEL[industry]}…`);
  const parts = queryParts(cc, industry);
  const byId = new Map();
  for (const [index, selectors] of parts.entries()) {
    // Each part is cached on its own, so a failure resumes where it stopped.
    const partFile = parts.length > 1 ? path.join(CACHE, `osm-${cc}-${industry}-part${index + 1}.json`) : null;
    let elements;
    if (partFile && existsSync(partFile)) {
      elements = JSON.parse(await readFile(partFile, "utf8"));
    } else {
      elements = await fetchOverpass(overpassQuery(cc, selectors), `${cc}/${industry}${parts.length > 1 ? ` part ${index + 1}/${parts.length}` : ""}`);
      if (partFile) await writeFile(partFile, JSON.stringify(elements));
      if (parts.length > 1) log(`  part ${index + 1}/${parts.length}: ${elements.length} listings`);
      await sleep(10_000); // be gentle with the public servers
    }
    for (const element of elements) byId.set(`${element.type}/${element.id}`, element);
  }
  const elements = [...byId.values()];
  await writeFile(file, JSON.stringify(elements));
  log(`OSM: ${elements.length} ${COUNTRY_NAME[cc]} / ${INDUSTRY_LABEL[industry]} listings`);
  return elements;
}

// ─── Email hygiene ──────────────────────────────────────────────────────────

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "hotmail.com", "hotmail.co.uk", "outlook.com",
  "live.com", "live.co.uk", "msn.com", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me", "gmx.com", "zoho.com", "yandex.com",
  "btinternet.com", "sky.com", "virginmedia.com", "talktalk.net",
]);
const PLACEHOLDER_DOMAINS = /(^|\.)(example\.(com|org|net)|domain\.com|email\.com|yourdomain|yoursite|mysite|test\.com|sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|wix\.com|godaddy\.com|squarespace\.com|mailchimp\.com|w3\.org|schema\.org|png|jpg|jpeg|gif|webp|svg)$/i;
const EXCLUDED_DOMAINS = /(\.gov(\.[a-z]{2})?|\.gob\.[a-z]{2}|\.nhs\.uk|nhs\.net|\.sch\.uk|\.ac\.uk|\.police\.uk|\.mil(\.[a-z]{2})?|\.mod\.uk|\.parliament\.uk)$/i;
const BAD_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|noreply|mailer-daemon|postmaster|abuse|webmaster|hostmaster|privacy|gdpr|dpo|unsubscribe|bounce|spam|example|test|user|name|email|your\.?name|yourname|someone)$/i;
const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi;

function cleanEmail(raw) {
  if (!raw) return null;
  const email = String(raw).trim().replace(/^mailto:/i, "").replace(/[?#].*$/, "").replace(/[\s<>"'(),;:]+$/g, "").toLowerCase();
  if (email.length > 254) return null;
  const match = email.match(/^([a-z0-9][a-z0-9._%+-]{0,63})@([a-z0-9.-]+\.[a-z]{2,24})$/);
  if (!match) return null;
  const [, local, domain] = match;
  if (BAD_LOCAL.test(local) || PLACEHOLDER_DOMAINS.test(domain) || EXCLUDED_DOMAINS.test(domain)) return null;
  if (local.includes("..") || domain.includes("..") || /\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(email)) return null;
  return email;
}

function emailsFromTag(value) {
  return String(value ?? "")
    .split(/[;,\s/]+/)
    .map(cleanEmail)
    .filter(Boolean);
}

/** example.co.uk → example.co.uk; shop.example.com → example.com (close enough for matching a site to its emails). */
function baseDomain(host) {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  const secondLevel = /^(co|com|org|net|ac|gov|edu|ltd|plc|me|sch|nhs)$/;
  const keep = labels.length >= 3 && secondLevel.test(labels[labels.length - 2]) && labels[labels.length - 1].length === 2 ? 3 : 2;
  return labels.slice(-keep).join(".");
}

function normalizeWebsite(raw) {
  if (!raw) return null;
  let value = String(raw).trim().split(/[;\s]+/)[0];
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return null;
    // A social profile or link shortener is not the business's own site.
    const host = url.hostname.replace(/^www\./, "");
    if (/(^|\.)(facebook|instagram|twitter|linkedin|youtube|tiktok|whatsapp|google)\.com$|^(x\.com|fb\.com|wa\.me|t\.me|bit\.ly|goo\.gl|linktr\.ee|sites\.google\.com)$/i.test(host)) return null;
    return `${url.protocol}//${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return null;
  }
}

// ─── Mail server check (MX) ─────────────────────────────────────────────────

const resolver = new dnsPromises.Resolver({ timeout: 5000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8", "9.9.9.9"]);
const mxCache = new Map();

function domainAcceptsMail(domain) {
  if (!mxCache.has(domain)) {
    mxCache.set(
      domain,
      (async () => {
        try {
          const mx = await resolver.resolveMx(domain);
          if (mx.some((r) => r.exchange && r.exchange !== ".")) return true;
          if (mx.length > 0) return false;
        } catch (err) {
          if (!["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(err.code)) return null; // unknown: resolver trouble
        }
        try {
          return (await resolver.resolve4(domain)).length > 0;
        } catch (err) {
          return ["ENOTFOUND", "ENODATA", "NXDOMAIN"].includes(err.code) ? false : null;
        }
      })()
    );
  }
  return mxCache.get(domain);
}

// ─── Website crawl (businesses that list only a website) ────────────────────

async function fetchText(url, maxBytes = 1_500_000, timeoutMs = 12_000) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5", "Accept-Language": "en" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (type && !/text|html|xml/i.test(type)) throw new Error(`not a page (${type})`);
  const reader = res.body?.getReader();
  if (!reader) return { text: "", url: res.url };
  const chunks = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  return { text: Buffer.concat(chunks).toString("utf8"), url: res.url };
}

/** Disallow rules for `User-agent: *` (and our own name). */
async function robotsRules(origin) {
  try {
    const { text } = await fetchText(`${origin}/robots.txt`, 200_000, 8000);
    const rules = [];
    let applies = false;
    let inGroupHeader = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.replace(/#.*$/, "").trim();
      const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
      if (!m) continue;
      const [, key, value] = m;
      if (key.toLowerCase() === "user-agent") {
        if (!inGroupHeader) applies = false;
        inGroupHeader = true;
        if (value === "*" || /lead-finder/i.test(value)) applies = true;
      } else {
        inGroupHeader = false;
        if (applies && key.toLowerCase() === "disallow" && value) rules.push(value);
      }
    }
    return rules.map((rule) => new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`));
  } catch {
    return []; // no robots.txt: nothing is disallowed
  }
}

function decodeCloudflare(hex) {
  try {
    const key = Number.parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch {
    return "";
  }
}

function emailsInHtml(html) {
  const found = [];
  const text = html
    .replace(/&#0*64;|&#x0*40;|&commat;/gi, "@")
    .replace(/&#0*46;|&#x0*2e;|&period;/gi, ".")
    .replace(/%40/g, "@");
  for (const m of text.matchAll(/href\s*=\s*["']mailto:([^"'?]+)/gi)) found.push(decodeURIComponent(m[1]));
  for (const m of text.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi)) found.push(decodeCloudflare(m[1]));
  for (const m of text.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) found.push(decodeCloudflare(m[1]));
  const visible = text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  for (const m of visible.matchAll(EMAIL_RE)) found.push(m[0]);
  return found;
}

const CONTACT_LINK = /(contact|about|get-in-touch|getintouch|reach-us|enquir|inquir|location|find-us)/i;

async function crawlSite(website) {
  let origin;
  try {
    origin = new URL(website).origin;
  } catch {
    return { emails: [], note: "bad url" };
  }
  const rules = await robotsRules(origin);
  const allowed = (url) => {
    const p = new URL(url).pathname;
    return !rules.some((rule) => rule.test(p));
  };
  if (!allowed(`${origin}/`)) return { emails: [], note: "robots.txt disallows" };

  const site = baseDomain(new URL(website).hostname);
  const emails = [];
  const visited = new Set();
  const queue = [website];
  let pages = 0;
  while (queue.length > 0 && pages < 3) {
    const url = queue.shift();
    if (visited.has(url) || !allowed(url)) continue;
    visited.add(url);
    pages++;
    let page;
    try {
      page = await fetchText(url);
    } catch (err) {
      if (pages === 1) return { emails: [], note: String(err.message ?? err).slice(0, 80) };
      continue;
    }
    for (const raw of emailsInHtml(page.text)) {
      const email = cleanEmail(raw);
      if (!email) continue;
      const domain = email.split("@")[1];
      // A site's own address, or a free-mail address it lists; never a web designer's credit.
      if (baseDomain(domain) === site || baseDomain(domain) === baseDomain(new URL(page.url).hostname) || FREEMAIL.has(domain)) {
        if (!emails.includes(email)) emails.push(email);
      }
    }
    if (emails.length >= 2) break;
    if (pages === 1) {
      const base = page.url;
      for (const m of page.text.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)) {
        if (!CONTACT_LINK.test(m[1]) && !CONTACT_LINK.test(m[2])) continue;
        try {
          const link = new URL(m[1], base);
          if (link.origin === new URL(base).origin && !queue.includes(link.href) && queue.length < 2) queue.push(link.href);
        } catch {
          /* not a usable link */
        }
      }
    }
  }
  return { emails, note: emails.length ? "found" : "no email on site" };
}

async function pool(items, size, worker, label) {
  let next = 0;
  let done = 0;
  const started = Date.now();
  async function run() {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
      done++;
      if (done % 100 === 0 || done === items.length) {
        const rate = done / ((Date.now() - started) / 1000);
        log(`  ${label}: ${done}/${items.length} (${rate.toFixed(1)}/s)`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
}

// ─── Building the list ──────────────────────────────────────────────────────

function cityOf(tags) {
  return (tags["addr:city"] || tags["addr:town"] || tags["addr:district"] || tags["addr:state"] || tags["is_in:city"] || "").trim();
}

function toBusiness(cc, industry, element) {
  const tags = element.tags ?? {};
  if (!tags.name || tags["brand:wikidata"] || tags.disused || tags["disused:amenity"]) return null;
  const emails = [...new Set([...emailsFromTag(tags.email), ...emailsFromTag(tags["contact:email"])])];
  const website = normalizeWebsite(tags.website || tags["contact:website"] || tags.url);
  if (emails.length === 0 && !website) return null;
  const selectorLabel = SELECTORS.find(([ind]) => ind === industry)?.[2] ?? "Business";
  return {
    key: `${element.type}/${element.id}`,
    cc,
    industry,
    name: tags.name.trim(),
    kind: describe(tags, selectorLabel),
    city: cityOf(tags),
    website,
    phone: (tags.phone || tags["contact:phone"] || tags["contact:mobile"] || "").split(";")[0].trim(),
    emails,
    source: emails.length ? "OpenStreetMap listing" : "",
  };
}

function seededShuffle(list, seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const HEADERS = [
  "First Name", "Last Name", "Title", "Company Name", "Website", "Contact LI Profile URL", "Email 1", "Email 2", "Personal Email",
  "Contact Phone 1", "Company Phone 1", "Contact Phone 2", "Contact Phone 3", "Contact Location", "Company Description",
  // Not read by the importer; kept with each imported row for reference.
  "Industry", "Country", "Email Source", "OSM Id",
];

function toRow(b) {
  const place = [b.city, COUNTRY_NAME[b.cc]].filter(Boolean).join(", ");
  const row = {
    "Company Name": b.name,
    Website: b.website ?? "",
    "Email 1": b.emails[0] ?? "",
    "Email 2": b.emails[1] ?? "",
    "Company Phone 1": b.phone,
    "Contact Location": place,
    "Company Description": `${b.kind} in ${place}.`,
    Industry: INDUSTRY_LABEL[b.industry],
    Country: COUNTRY_NAME[b.cc],
    "Email Source": b.source,
    "OSM Id": b.key,
  };
  return HEADERS.map((h) => csvCell(row[h] ?? "")).join(",");
}

async function main() {
  await mkdir(CACHE, { recursive: true });
  log(`Output: ${OUT}  target: ${TARGET}  markets: ${COUNTRIES.join(", ")}`);

  // 1. Listings from OpenStreetMap.
  const byCountry = {};
  for (const cc of COUNTRIES) {
    byCountry[cc] = [];
    const seen = new Set();
    for (const industry of INDUSTRIES) {
      for (const element of await osmElements(cc, industry)) {
        const business = toBusiness(cc, industry, element);
        if (business && !seen.has(business.key)) {
          seen.add(business.key);
          byCountry[cc].push(business);
        }
      }
    }
    log(`${COUNTRY_NAME[cc]}: ${byCountry[cc].length} businesses with an email or website`);
  }

  // 2. Emails from the websites of Pakistani and Emirati businesses that list none.
  const crawlFile = path.join(CACHE, "crawl.json");
  const crawled = existsSync(crawlFile) ? JSON.parse(await readFile(crawlFile, "utf8")) : {};
  const toCrawl = COUNTRIES.filter((cc) => cc !== "GB")
    .flatMap((cc) => byCountry[cc])
    .filter((b) => b.emails.length === 0 && b.website && !(b.website in crawled));
  // One request at a time per site: group by host so the same host is never fetched in parallel.
  const hosts = [...new Set(toCrawl.map((b) => new URL(b.website).hostname))];
  if (hosts.length) log(`Crawling ${hosts.length} websites for a contact email…`);
  const firstSiteOfHost = new Map(toCrawl.map((b) => [new URL(b.website).hostname, b.website]));
  let saved = 0;
  await pool(hosts, 12, async (host) => {
    const website = firstSiteOfHost.get(host);
    try {
      crawled[website] = await crawlSite(website);
    } catch (err) {
      crawled[website] = { emails: [], note: String(err.message ?? err).slice(0, 80) };
    }
    if (++saved % 200 === 0) await writeFile(crawlFile, JSON.stringify(crawled));
  }, "websites");
  await writeFile(crawlFile, JSON.stringify(crawled));
  for (const cc of COUNTRIES) {
    for (const b of byCountry[cc]) {
      if (b.emails.length === 0 && b.website) {
        const hit = crawled[b.website] ?? crawled[firstSiteOfHost.get(new URL(b.website).hostname)];
        if (hit?.emails?.length) {
          b.emails = hit.emails.slice(0, 2);
          b.source = "Business's own website";
        }
      }
    }
  }

  // 3. Keep what is usable: company domains only in the UK, one business per domain, a live mail server.
  const usedEmails = new Set();
  const usedDomains = new Set();
  const candidates = {};
  for (const cc of COUNTRIES) {
    const list = [];
    for (const b of seededShuffle(byCountry[cc], 20261113)) {
      b.emails = b.emails.filter((e) => !(cc === "GB" && FREEMAIL.has(e.split("@")[1])));
      if (b.emails.length === 0) continue;
      const domain = b.emails[0].split("@")[1];
      if (b.emails.some((e) => usedEmails.has(e))) continue;
      if (!FREEMAIL.has(domain) && usedDomains.has(domain)) continue;
      b.emails.forEach((e) => usedEmails.add(e));
      if (!FREEMAIL.has(domain)) usedDomains.add(domain);
      list.push(b);
    }
    candidates[cc] = list;
  }

  log("Checking mail servers (MX)…");
  const domains = [...new Set(Object.values(candidates).flat().flatMap((b) => b.emails.map((e) => e.split("@")[1])))].filter((d) => !FREEMAIL.has(d));
  await pool(domains, 24, (domain) => domainAcceptsMail(domain), "domains");
  for (const cc of COUNTRIES) {
    const kept = [];
    for (const b of candidates[cc]) {
      const checks = await Promise.all(b.emails.map((e) => (FREEMAIL.has(e.split("@")[1]) ? true : domainAcceptsMail(e.split("@")[1]))));
      // `null` = the resolver could not tell: keep it; the importer checks again and bounces are handled.
      b.emails = b.emails.filter((_, i) => checks[i] !== false);
      if (b.emails.length) kept.push(b);
    }
    candidates[cc] = kept;
  }

  // 4. Pick: every usable Pakistani and Emirati business, then the UK up to the target,
  //    balanced across the four industries.
  const picked = {};
  let total = 0;
  for (const cc of COUNTRIES.filter((c) => c !== "GB")) {
    picked[cc] = candidates[cc];
    total += picked[cc].length;
  }
  if (COUNTRIES.includes("GB")) {
    const room = Math.max(0, TARGET - total);
    const byIndustry = Object.fromEntries(INDUSTRIES.map((ind) => [ind, candidates.GB.filter((b) => b.industry === ind)]));
    const chosen = [];
    let progress = true;
    while (chosen.length < room && progress) {
      progress = false;
      for (const ind of INDUSTRIES) {
        if (chosen.length >= room) break;
        const next = byIndustry[ind].shift();
        if (next) {
          chosen.push(next);
          progress = true;
        }
      }
    }
    picked.GB = chosen;
    total += chosen.length;
  }

  // 5. Files.
  const summary = { generatedAt: new Date().toISOString(), target: TARGET, total, markets: {} };
  for (const cc of COUNTRIES) {
    const rows = picked[cc] ?? [];
    const file = path.join(OUT, `leads-${FILE_CODE[cc]}.csv`);
    await writeFile(file, `﻿${HEADERS.join(",")}\r\n${rows.map(toRow).join("\r\n")}\r\n`, "utf8");
    summary.markets[COUNTRY_NAME[cc]] = {
      file: path.basename(file),
      leads: rows.length,
      fromListing: rows.filter((b) => b.source === "OpenStreetMap listing").length,
      fromWebsite: rows.filter((b) => b.source === "Business's own website").length,
      freeMail: rows.filter((b) => FREEMAIL.has(b.emails[0].split("@")[1])).length,
      byIndustry: Object.fromEntries(INDUSTRIES.map((ind) => [INDUSTRY_LABEL[ind], rows.filter((b) => b.industry === ind).length])),
      topCities: Object.entries(rows.reduce((acc, b) => ((acc[b.city || "(no city)"] = (acc[b.city || "(no city)"] ?? 0) + 1), acc), {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    };
    log(`${COUNTRY_NAME[cc]}: ${rows.length} leads → ${file}`);
  }
  await writeFile(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
  log(`Done: ${total} leads.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
