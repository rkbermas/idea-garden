import type { Idea } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export const nowIso = () => new Date().toISOString();

/** Remove markdown syntax for previews and sentence detection. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/==(.+?)==/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstSentence(content: string, max = 96): string {
  const plain = stripMarkdown(content);
  if (!plain) return "";
  const m = plain.match(/^(.+?[.!?])(\s|$)/);
  let s = m ? m[1] : plain;
  if (s.length > max) {
    s = s.slice(0, max);
    const cut = s.lastIndexOf(" ");
    s = (cut > max * 0.6 ? s.slice(0, cut) : s).replace(/[,;:\s]+$/, "") + "…";
  }
  return s;
}

export function displayTitle(idea: Pick<Idea, "title" | "content">): string {
  const t = idea.title?.trim();
  if (t) return t;
  return firstSentence(idea.content) || "Untitled idea";
}

/** Body preview that doesn't repeat the derived title. */
export function previewText(idea: Pick<Idea, "title" | "content">, max = 220): string {
  const plain = stripMarkdown(idea.content);
  let body = plain;
  if (!idea.title?.trim()) {
    const first = firstSentence(idea.content, 10_000);
    body = plain.slice(first.length).trim();
  }
  if (body.length > max) {
    body = body.slice(0, max);
    const cut = body.lastIndexOf(" ");
    body = (cut > max * 0.6 ? body.slice(0, cut) : body) + "…";
  }
  return body;
}

export const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export const normalizeTag = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/[^\p{L}\p{N}\s/_-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

const DAY = 86_400_000;

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

export function relativeDays(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const months = Math.round(d / 30.4);
  if (d < 365) return months === 1 ? "a month ago" : `${months} months ago`;
  const years = Math.round(d / 365);
  return years === 1 ? "a year ago" : `${years} years ago`;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  return relativeDays(iso);
}

export function formatDate(iso: string, opts?: { year?: boolean }): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: opts?.year || !sameYear ? "numeric" : undefined,
  });
}

export function dayLabel(iso: string): string {
  const d = daysSince(startOfDayIso(iso));
  if (d <= 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: "long" });
  return formatDate(iso);
}

function startOfDayIso(iso: string) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export const plural = (n: number, one: string, many = one + "s") =>
  `${n} ${n === 1 ? one : many}`;

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
