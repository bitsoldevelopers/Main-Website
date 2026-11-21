/**
 * The words a person wrote in an email: the text part of the message,
 * decoded, without the quoted email they are answering or their signature.
 * Pure and dependency-free, so it is tested on raw sources without a server.
 *
 * Good enough for replies (what the auto-reply needs), not a full MIME parser:
 * attachments are skipped, and HTML is only used when there is no text part.
 */

const MAX_DEPTH = 6;

interface Part {
  headers: Map<string, string>;
  body: string;
}

function splitPart(raw: string): Part {
  const end = raw.search(/\r?\n\r?\n/);
  const block = end === -1 ? raw : raw.slice(0, end);
  const body = end === -1 ? "" : raw.slice(end).replace(/^\r?\n\r?\n/, "");
  const headers = new Map<string, string>();
  for (const line of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!headers.has(name)) headers.set(name, line.slice(colon + 1).trim());
  }
  return { headers, body };
}

function param(header: string, name: string): string {
  const match = header.match(new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? "") : "";
}

function decodeBytes(bytes: Buffer, charset: string): string {
  const label = (charset || "utf-8").toLowerCase();
  try {
    return new TextDecoder(label === "us-ascii" ? "utf-8" : label).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
}

function decodeBody(part: Part): string {
  const encoding = (part.headers.get("content-transfer-encoding") ?? "").toLowerCase();
  const charset = param(part.headers.get("content-type") ?? "", "charset");
  if (encoding === "base64") return decodeBytes(Buffer.from(part.body.replace(/[^A-Za-z0-9+/=]/g, ""), "base64"), charset);
  if (encoding === "quoted-printable") {
    const soft = part.body.replace(/=\r?\n/g, "");
    const bytes: number[] = [];
    for (let i = 0; i < soft.length; i++) {
      const hex = soft[i] === "=" ? soft.slice(i + 1, i + 3) : "";
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 2;
      } else {
        // Characters outside latin1 cannot be in a QP body; keep them as UTF-8 anyway.
        for (const b of Buffer.from(soft[i], "utf8")) bytes.push(b);
      }
    }
    return decodeBytes(Buffer.from(bytes), charset);
  }
  // 7bit / 8bit / binary: the source was read as UTF-8 already.
  return part.body;
}

/** The first text/plain part, else the first text/html part as text. */
function findText(raw: string, depth: number): { kind: "plain" | "html"; text: string } | null {
  if (depth > MAX_DEPTH) return null;
  const part = splitPart(raw);
  const type = (part.headers.get("content-type") ?? "text/plain").toLowerCase();
  const disposition = (part.headers.get("content-disposition") ?? "").toLowerCase();

  if (type.startsWith("multipart/")) {
    const boundary = param(part.headers.get("content-type") ?? "", "boundary");
    if (!boundary) return null;
    const pieces = part.body.split(`--${boundary}`).slice(1);
    let html: { kind: "plain" | "html"; text: string } | null = null;
    for (const piece of pieces) {
      if (piece.startsWith("--")) break;
      const found = findText(piece.replace(/^\r?\n/, ""), depth + 1);
      if (found?.kind === "plain") return found;
      if (found && !html) html = found;
    }
    return html;
  }
  if (disposition.startsWith("attachment")) return null;
  if (type.startsWith("text/plain")) return { kind: "plain", text: decodeBody(part) };
  if (type.startsWith("text/html")) return { kind: "html", text: htmlToText(decodeBody(part)) };
  return null;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    // Gmail and Outlook put the quoted email in these; drop it here, before the tags go.
    .replace(/<blockquote[\s\S]*<\/blockquote>/gi, "")
    .replace(/<div[^>]*class="?gmail_quote[\s\S]*$/i, "")
    .replace(/<div[^>]*id="?(divRplyFwdMsg|appendonsend)[\s\S]*$/i, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (entity, name: string) => {
      const key = name.toLowerCase();
      if (key in ENTITIES) return ENTITIES[key];
      if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      return entity;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Where the quoted email or the signature starts, line by line. */
const CUT_LINES = [
  /^On .{0,200}(wrote|écrit|schrieb|escribió):?\s*$/i,
  /^-{2,}\s*(Original Message|Forwarded message)\s*-{2,}/i,
  /^_{8,}\s*$/,
  /^(From|De|Von):\s.+/i, // Outlook's header block above the quoted email
  /^Sent from my (iPhone|iPad|Android|Samsung|mobile)/i,
  /^Get Outlook for /i,
  /^--\s*$/, // the standard signature separator
];

/** Drops the quoted email (lines starting with ">" and everything after "On … wrote:") and the signature. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // "On Mon, 21 Nov 2026 at 10:00, BITSOL <a@b>" + "wrote:" on the next line.
    const joined = `${line} ${lines[i + 1]?.trim() ?? ""}`;
    if (CUT_LINES.some((re) => re.test(line.trim())) || (/^On\s/i.test(line.trim()) && /wrote:\s*$/i.test(joined) && line.length < 200)) break;
    if (line.trimStart().startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** What the sender wrote: decoded, quote and signature removed, at most `max` characters. */
export function extractReplyText(raw: string, max = 6000): string {
  const found = findText(raw, 0);
  if (!found) return "";
  return stripQuoted(found.text).slice(0, max);
}

// ─── Automatic acknowledgements ─────────────────────────────────────────────

/** Subjects only a helpdesk or autoresponder writes. */
const ACK_SUBJECT =
  /^\s*(re:\s*)?(thanks?( you)? for (contacting|your (email|message|enquiry|inquiry|mail))|we('ve| have) received your|your (email|message|enquiry|inquiry|request) (has been|was) received|(request|ticket|case|enquiry) (received|#|no\.?|number)|\[?(ticket|case|request) #?\d)/i;
/** "Your email has been received" / "we have received your message". */
const ACK_RECEIVED = /(your (e-?mail|message|enquiry|inquiry|request|mail) (has been|was|is) (received|safely received)|we('ve| have) (received|got) your (e-?mail|message|enquiry|inquiry|request|mail)|thank you for (contacting|getting in touch with) us)/i;
/** "One of the team will get back to you shortly" / "we will respond within 24 hours". */
const ACK_PROMISE = /(one of (the|our) (team|staff|colleagues|representatives)|(a|our) (member of (the|our) )?team (member )?will|we (will|'ll|shall) (get back to|respond to|reply to|contact|be in touch with) you|(respond|reply|get back to you) (within|as soon as)|during (our|normal) (business|office|working) hours)/i;
const ACK_MACHINE = /(this is an? (automated|automatic|auto-generated) (reply|response|message|email)|do not reply (to|directly to) this (e-?mail|message)|this (mailbox|inbox|address) is (not monitored|unattended))/i;

/**
 * A helpdesk's "thanks, we got your email" sent by a machine. Many of these
 * carry none of the auto-reply headers, so the words are the only sign. A
 * person rarely writes both "your email has been received" and "one of the
 * team will get back to you" to a sales email.
 */
export function looksLikeAutoAck(subject: string, text: string): boolean {
  const head = text.slice(0, 1500);
  if (ACK_MACHINE.test(head)) return true;
  if (ACK_SUBJECT.test(subject)) return true;
  return ACK_RECEIVED.test(head) && ACK_PROMISE.test(head);
}
