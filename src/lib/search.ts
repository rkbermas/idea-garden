import type { Idea } from "./types";
import { stripMarkdown } from "./text";

export interface SearchRecord {
  idea: Idea;
  title: string;
  content: string;
  thoughts: string;
  tags: string[];
  topics: string[];
  sourceTitle: string;
  author: string;
  reflections: string;
}

export interface ParsedQuery {
  terms: string[];
  tag: string[];
  topic: string[];
  source: string[];
  author: string[];
}

export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { terms: [], tag: [], topic: [], source: [], author: [] };
  const re = /(\w+):"([^"]+)"|(\w+):(\S+)|#(\S+)|"([^"]+)"|(\S+)/g;
  for (const m of q.matchAll(re)) {
    const key = (m[1] ?? m[3])?.toLowerCase();
    const val = (m[2] ?? m[4])?.toLowerCase();
    if (key && val && (key === "tag" || key === "topic" || key === "source" || key === "author")) {
      out[key].push(val);
    } else if (m[5]) out.tag.push(m[5].toLowerCase());
    else if (m[6]) out.terms.push(m[6].toLowerCase());
    else {
      const raw = (m[7] ?? m[0]).toLowerCase();
      if (raw.length) out.terms.push(raw);
    }
  }
  return out;
}

export const isEmptyQuery = (p: ParsedQuery) =>
  !p.terms.length && !p.tag.length && !p.topic.length && !p.source.length && !p.author.length;

function scoreField(hay: string, term: string, weight: number): number {
  if (!hay) return 0;
  const idx = hay.indexOf(term);
  if (idx === -1) return 0;
  const atWord = idx === 0 || /[\s\p{P}]/u.test(hay[idx - 1]);
  return weight * (atWord ? 1 : 0.45);
}

export function searchIdeas(records: SearchRecord[], query: string): { idea: Idea; score: number }[] {
  const p = parseQuery(query);
  if (isEmptyQuery(p)) return records.map((r) => ({ idea: r.idea, score: 0 }));
  const results: { idea: Idea; score: number }[] = [];
  for (const r of records) {
    if (p.tag.length && !p.tag.every((t) => r.tags.some((x) => x === t || x.startsWith(t)))) continue;
    if (p.topic.length && !p.topic.every((t) => r.topics.some((x) => x.includes(t)))) continue;
    if (p.source.length && !p.source.every((t) => r.sourceTitle.includes(t))) continue;
    if (p.author.length && !p.author.every((t) => r.author.includes(t))) continue;

    let total = p.tag.length + p.topic.length + p.source.length + p.author.length;
    let ok = true;
    for (const term of p.terms) {
      const s =
        scoreField(r.title, term, 6) +
        scoreField(r.tags.join(" "), term, 4) +
        scoreField(r.topics.join(" "), term, 3) +
        scoreField(r.sourceTitle, term, 3) +
        scoreField(r.author, term, 3) +
        scoreField(r.content, term, 2) +
        scoreField(r.thoughts, term, 1.5) +
        scoreField(r.reflections, term, 1);
      if (s === 0) {
        ok = false;
        break;
      }
      total += s;
    }
    if (ok) results.push({ idea: r.idea, score: total });
  }
  return results.sort((a, b) => b.score - a.score);
}

export function toRecordText(s: string | null | undefined) {
  return stripMarkdown(s ?? "").toLowerCase();
}

/** Split text into highlighted and plain runs for the given terms. */
export function highlightRuns(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const clean = terms.filter((t) => t.length > 1);
  if (!clean.length || !text) return [{ text, hit: false }];
  const re = new RegExp(`(${clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text
    .split(re)
    .filter((s) => s.length)
    .map((s) => ({ text: s, hit: clean.includes(s.toLowerCase()) }));
}

/** A snippet of plain text centered on the first matching term. */
export function snippetAround(text: string, terms: string[], len = 200): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1 || idx < len * 0.6) return text.length > len ? text.slice(0, len) + "…" : text;
  const start = Math.max(0, idx - Math.floor(len * 0.35));
  const s = text.slice(start, start + len);
  return "…" + s.slice(s.indexOf(" ") + 1) + (start + len < text.length ? "…" : "");
}
