import { stripMarkdown } from "./text";

const STOP = new Set(
  (
    "a about above after again against all am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each few for from further had has have having he her here hers herself him himself his how " +
    "i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out " +
    "over own same she should so some such than that the their theirs them themselves then there these they this those through to " +
    "too under until up very was we were what when where which while who whom why will with would you your yours yourself " +
    "yourselves also often even much many may might one ones thing things something someone people way ways make makes made get gets " +
    "really rather without within whether us let lets like seem seems still yet every another"
  ).split(" ")
);

export function stem(w: string): string {
  if (w.length <= 4) return w;
  return w
    .replace(/(ational|ization|fulness|ousness|iveness)$/, "")
    .replace(/(ingly|edly|ness|ment|ings|ies)$/, (m) => (m === "ies" ? "y" : ""))
    .replace(/(ing|ed|ly|es|s)$/, "")
    .replace(/(.)\1$/, "$1");
}

export function tokenize(text: string): string[] {
  return stripMarkdown(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem)
    .filter((w) => w.length > 2);
}

export interface Doc {
  id: string;
  text: string;
  /** Extra weighted terms, e.g. tags and topic names. */
  boosts?: string[];
}

export interface SimilarityIndex {
  vectors: Map<string, Map<string, number>>;
  similar(id: string, limit?: number, exclude?: Set<string>): { id: string; score: number }[];
  query(text: string, limit?: number): { id: string; score: number }[];
}

export function buildIndex(docs: Doc[]): SimilarityIndex {
  const tfs = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  for (const d of docs) {
    const tf = new Map<string, number>();
    for (const t of tokenize(d.text)) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const b of d.boosts ?? []) for (const t of tokenize(b)) tf.set(t, (tf.get(t) ?? 0) + 2.5);
    tfs.set(d.id, tf);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = Math.max(docs.length, 1);
  const idf = (t: string) => Math.log(1 + n / (1 + (df.get(t) ?? 0)));

  const weigh = (tf: Map<string, number>) => {
    const v = new Map<string, number>();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * idf(t);
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  };

  const vectors = new Map<string, Map<string, number>>();
  for (const [id, tf] of tfs) vectors.set(id, weigh(tf));

  const cosine = (a: Map<string, number>, b: Map<string, number>) => {
    const [small, big] = a.size < b.size ? [a, b] : [b, a];
    let s = 0;
    for (const [t, w] of small) {
      const o = big.get(t);
      if (o) s += w * o;
    }
    return s;
  };

  const rank = (v: Map<string, number>, limit: number, skip: (id: string) => boolean) => {
    const out: { id: string; score: number }[] = [];
    for (const [id, other] of vectors) {
      if (skip(id)) continue;
      const score = cosine(v, other);
      if (score > 0.04) out.push({ id, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  return {
    vectors,
    similar(id, limit = 6, exclude) {
      const v = vectors.get(id);
      if (!v) return [];
      return rank(v, limit, (o) => o === id || !!exclude?.has(o));
    },
    query(text, limit = 20) {
      const tf = new Map<string, number>();
      for (const t of tokenize(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
      if (!tf.size) return [];
      return rank(weigh(tf), limit, () => false);
    },
  };
}

export function similarityLabel(score: number): "high" | "medium" | "low" {
  if (score >= 0.22) return "high";
  if (score >= 0.11) return "medium";
  return "low";
}
