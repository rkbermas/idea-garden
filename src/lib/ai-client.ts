"use client";

import { HAS_SUPABASE } from "./env";
import type { Snapshot } from "./types";
import { displayTitle } from "./text";

export interface CompactIdea {
  id: string;
  title: string;
  content: string;
  thoughts?: string;
  tags?: string[];
  topics?: string[];
  source?: string;
}

export type AIRequest =
  | { action: "suggest"; ideaId: string }
  | { action: "ask"; question: string }
  | { action: "contradictions"; topicId?: string }
  | { action: "summarize"; topicId: string }
  | { action: "search"; query: string };

export interface AIResponses {
  suggest: { suggestions: { id: string; strength: "high" | "medium" | "low"; reason: string }[] };
  ask: { answer: string; cited: string[] };
  contradictions: { pairs: { a: string; b: string; reason: string }[] };
  summarize: { summary: string; cited: string[] };
  search: { results: { id: string; reason: string }[] };
}

/** In demo mode the server can't see browser storage, so the library travels with the request. */
export function compactLibrary(s: Snapshot): CompactIdea[] {
  const tagName = new Map(s.tags.map((t) => [t.id, t.name]));
  const topicName = new Map(s.topics.map((t) => [t.id, t.name]));
  const src = new Map(s.sources.map((x) => [x.id, x]));
  return s.ideas
    .filter((i) => !i.archived)
    .map((i) => {
      const so = i.source_id ? src.get(i.source_id) : undefined;
      return {
        id: i.id,
        title: displayTitle(i),
        content: i.content.slice(0, 1200),
        thoughts: i.personal_thoughts?.slice(0, 600) || undefined,
        tags: s.ideaTags.filter((x) => x.idea_id === i.id).map((x) => tagName.get(x.tag_id)!).filter(Boolean),
        topics: s.ideaTopics.filter((x) => x.idea_id === i.id).map((x) => topicName.get(x.topic_id)!).filter(Boolean),
        source: so ? `${so.title}${so.author ? ` — ${so.author}` : ""}` : undefined,
      };
    });
}

export async function callAI<A extends AIRequest["action"]>(
  req: Extract<AIRequest, { action: A }>,
  snapshot: Snapshot
): Promise<AIResponses[A]> {
  const body: Record<string, unknown> = { ...req };
  if (!HAS_SUPABASE) {
    body.library = compactLibrary(snapshot);
    const topicId = (req as { topicId?: string }).topicId;
    if (topicId) {
      const topic = snapshot.topics.find((t) => t.id === topicId);
      body.topicName = topic?.name;
    }
  }
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & AIResponses[A];
  if (!res.ok) throw new Error(json.error ?? "The AI request failed.");
  return json;
}
