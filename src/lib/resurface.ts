import { daysSince } from "./text";
import type { Idea } from "./types";

const lastSeen = (i: Idea) => i.last_viewed_at ?? i.created_at;

/** Ideas not opened for at least `minDays`, longest-unseen first. */
export function forgottenIdeas(ideas: Idea[], minDays = 21): Idea[] {
  return ideas
    .filter((i) => daysSince(lastSeen(i)) >= minDays)
    .sort((a, b) => lastSeen(a).localeCompare(lastSeen(b)));
}

/**
 * A resurfacing order for Random Idea: weighted toward ideas that haven't been
 * seen for a while, but every idea can come up.
 */
export function resurfaceQueue(ideas: Idea[]): string[] {
  const weighted = ideas.map((i) => {
    const d = Math.min(daysSince(lastSeen(i)), 365);
    const w = 1 + Math.sqrt(Math.max(d, 0));
    // Efraimidis–Spirakis weighted shuffle
    return { id: i.id, key: Math.pow(Math.random(), 1 / w) };
  });
  return weighted.sort((a, b) => b.key - a.key).map((x) => x.id);
}

export { lastSeen };
