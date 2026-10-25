import type { ChatKnowledge } from "@prisma/client";
import type { KnowledgeEntry } from "@/types/chat";
import { prisma } from "@/lib/prisma";
import { MARKETING_KNOWLEDGE_BASE } from "@/data/marketing/knowledge-base";

/**
 * Knowledge retrieval.
 *
 * The assistant answers from the Knowledge Base in Admin → Chatbot. While that
 * table is empty the built-in entries in `data/marketing/knowledge-base.ts`
 * apply; once it has rows, only its PUBLISHED entries are used, so an edit in
 * the panel changes the next answer. The table is read at most every 30
 * seconds, and a database outage falls back to the built-in entries.
 *
 * Ranking is a light keyword-overlap search — dependency-free on purpose.
 * Swapping in vector search later means changing `rankKnowledge` only.
 */

const CACHE_MS = 30_000;

export type KnowledgeSource = "database" | "defaults";

interface KnowledgeCache {
  entries: KnowledgeEntry[];
  source: KnowledgeSource;
  at: number;
}

let cache: KnowledgeCache | null = null;

export function toKnowledgeEntry(row: Pick<ChatKnowledge, "id" | "kind" | "category" | "question" | "answer" | "keywords">): KnowledgeEntry {
  const keywords = Array.isArray(row.keywords) ? row.keywords.filter((k): k is string => typeof k === "string") : [];
  return {
    id: row.id,
    kind: row.kind as KnowledgeEntry["kind"],
    category: row.category,
    question: row.question,
    answer: row.answer,
    keywords,
  };
}

/** The entries the assistant may answer from right now, and where they came from. */
export async function loadKnowledge(options: { fresh?: boolean } = {}): Promise<Pick<KnowledgeCache, "entries" | "source">> {
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache;

  let entries: KnowledgeEntry[] = MARKETING_KNOWLEDGE_BASE;
  let source: KnowledgeSource = "defaults";
  try {
    const total = await prisma.chatKnowledge.count();
    if (total > 0) {
      const rows = await prisma.chatKnowledge.findMany({
        where: { state: "PUBLISHED" },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        select: { id: true, kind: true, category: true, question: true, answer: true, keywords: true },
      });
      entries = rows.map(toKnowledgeEntry);
      source = "database";
    }
  } catch (error) {
    console.warn("[knowledge] using built-in entries:", error instanceof Error ? error.message.split("\n").find(Boolean) : error);
  }

  cache = { entries, source, at: Date.now() };
  return cache;
}

/** Forget the cached entries, e.g. right after an edit in the panel. */
export function invalidateKnowledgeCache(): void {
  cache = null;
}

/** Rank entries against a message: keyword hits, question-word overlap and category match. */
export function rankKnowledge(entries: KnowledgeEntry[], query: string, limit = 6): KnowledgeEntry[] {
  const q = normalize(query);
  if (!q) return [];

  const terms = new Set(q.split(" ").filter((t) => t.length > 2));

  return entries
    .map((entry) => {
      let score = 0;

      for (const keyword of entry.keywords) {
        const kw = normalize(keyword);
        if (!kw) continue;
        if (q.includes(kw)) score += kw.includes(" ") ? 5 : 3;
      }

      for (const word of normalize(entry.question).split(" ")) {
        if (word.length > 2 && terms.has(word)) score += 1;
      }

      if (q.includes(normalize(entry.category))) score += 2;

      // Service entries are the most common intent — nudge them up when the
      // query already looks like a catalogue lookup.
      if (entry.kind === "SERVICE" && score > 0) score += 1;

      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

export async function retrieveKnowledge(query: string, limit = 6): Promise<KnowledgeEntry[]> {
  const { entries } = await loadKnowledge();
  return rankKnowledge(entries, query, limit);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
