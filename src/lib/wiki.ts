import { normalize } from "./text";

export const WIKI_RE = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/g;

export interface WikiRef {
  target: string;
  alias: string | null;
}

export function parseWikiLinks(text: string | null | undefined): WikiRef[] {
  if (!text) return [];
  const out: WikiRef[] = [];
  for (const m of text.matchAll(WIKI_RE)) {
    out.push({ target: m[1].trim(), alias: m[2]?.trim() ?? null });
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Rewrite [[Old title]] and [[Old title|alias]] to point at a new title. */
export function renameWikiTarget(text: string, oldTitle: string, newTitle: string): string {
  if (!text || !oldTitle) return text;
  const re = new RegExp(`\\[\\[\\s*${escapeRe(oldTitle)}\\s*(\\|[^\\[\\]]+?)?\\]\\]`, "gi");
  return text.replace(re, (_m, alias?: string) => `[[${newTitle}${alias ?? ""}]]`);
}

export function referencesTitle(text: string | null | undefined, title: string): boolean {
  const key = normalize(title);
  return parseWikiLinks(text).some((r) => normalize(r.target) === key);
}

/**
 * When the caret sits just after an unclosed "[[", returns the query typed so far
 * and the index where "[[" starts.
 */
export function activeWikiQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf("[[");
  if (open === -1) return null;
  const segment = before.slice(open + 2);
  if (segment.includes("]]") || segment.includes("\n") || segment.length > 80) return null;
  return { start: open, query: segment };
}
