import type { RelationshipType } from "./types";

export interface Edge {
  a: string;
  b: string;
  kind: "link" | "wiki";
  relationship: RelationshipType | null;
}

/**
 * Communities by label propagation: each node repeatedly adopts the label most
 * common among its neighbours. Small and deterministic enough for a personal library.
 */
export function communities(nodes: string[], edges: Edge[], minSize = 3): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n, []);
  for (const e of edges) {
    if (!adj.has(e.a) || !adj.has(e.b)) continue;
    adj.get(e.a)!.push(e.b);
    adj.get(e.b)!.push(e.a);
  }
  const label = new Map<string, string>(nodes.map((n) => [n, n]));
  const order = [...nodes].sort();
  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (const n of order) {
      const nb = adj.get(n)!;
      if (!nb.length) continue;
      const counts = new Map<string, number>();
      for (const m of nb) counts.set(label.get(m)!, (counts.get(label.get(m)!) ?? 0) + 1);
      let best = label.get(n)!;
      let bestCount = counts.get(best) ?? 0;
      for (const [l, c] of counts) {
        if (c > bestCount || (c === bestCount && l < best)) {
          best = l;
          bestCount = c;
        }
      }
      if (best !== label.get(n)) {
        label.set(n, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const groups = new Map<string, string[]>();
  for (const [n, l] of label) {
    if (!adj.get(n)!.length) continue;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(n);
  }
  return [...groups.values()].filter((g) => g.length >= minSize).sort((x, y) => y.length - x.length);
}

/** Muted hues for topics in the graph; chosen to sit quietly on both themes. */
export const TOPIC_HUES = [
  { light: "#5B7F6A", dark: "#8DB59C" }, // juniper
  { light: "#8A6E4B", dark: "#C7A57A" }, // walnut
  { light: "#5A6F8F", dark: "#93A8C9" }, // slate
  { light: "#8B5D6E", dark: "#C793A6" }, // plum
  { light: "#6F7A3F", dark: "#B0BA78" }, // olive
  { light: "#4F7F86", dark: "#86BAC1" }, // teal
  { light: "#7A6496", dark: "#AE9BCB" }, // heather
  { light: "#94643F", dark: "#D29C72" }, // umber
];

export function topicHue(index: number, dark: boolean) {
  const h = TOPIC_HUES[index % TOPIC_HUES.length];
  return dark ? h.dark : h.light;
}
