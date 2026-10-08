"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getRepo, type Repo } from "@/lib/repo";
import { buildSeed } from "@/lib/seed";
import { buildIndex, type SimilarityIndex } from "@/lib/similarity";
import { toRecordText, type SearchRecord } from "@/lib/search";
import { communities, type Edge } from "@/lib/graph";
import { displayTitle, normalize, normalizeTag, nowIso, uid } from "@/lib/text";
import { parseWikiLinks, renameWikiTarget } from "@/lib/wiki";
import {
  emptySnapshot,
  type Connection,
  type Idea,
  type IdeaLink,
  type Profile,
  type Project,
  type Reflection,
  type RelationshipType,
  type Snapshot,
  type Source,
  type SourceType,
  type Tag,
  type Topic,
} from "@/lib/types";
import { useToast } from "./toast";

export interface NewSourceInput {
  title: string;
  author?: string | null;
  source_type: SourceType;
  url?: string | null;
}

export interface CaptureInput {
  title?: string | null;
  content: string;
  personal_thoughts?: string | null;
  sourceId?: string | null;
  newSource?: NewSourceInput | null;
  source_location?: string | null;
  tags?: string[];
  topicIds?: string[];
  projectIds?: string[];
  status?: "inbox" | "active";
}

type IdeaPatch = Partial<Pick<Idea, "title" | "content" | "personal_thoughts" | "source_location" | "favorite" | "archived" | "status" | "source_id">>;

interface Derived {
  ideas: Idea[]; // not archived, newest first
  archived: Idea[];
  inbox: Idea[];
  ideaById: Map<string, Idea>;
  sourceById: Map<string, Source>;
  tagById: Map<string, Tag>;
  topicById: Map<string, Topic>;
  projectById: Map<string, Project>;
  tagsByIdea: Map<string, Tag[]>;
  topicsByIdea: Map<string, Topic[]>;
  projectsByIdea: Map<string, Project[]>;
  ideasByTag: Map<string, string[]>;
  ideasByTopic: Map<string, string[]>;
  ideasByProject: Map<string, string[]>;
  ideasBySource: Map<string, string[]>;
  reflectionsByIdea: Map<string, Reflection[]>;
  titleIndex: Map<string, string>;
  connections: Map<string, Connection[]>;
  backlinks: Map<string, { ideas: string[]; projects: string[] }>;
  unresolved: Map<string, string[]>;
  degree: Map<string, number>;
  edges: Edge[];
  records: SearchRecord[];
  similarity: SimilarityIndex;
  clusters: string[][];
  topicOrder: Map<string, number>;
}

interface LibraryValue extends Derived {
  status: "loading" | "ready" | "error";
  error: string | null;
  mode: Repo["mode"];
  email: string | null;
  profile: Profile;
  data: Snapshot;
  resolveWiki(target: string): Idea | undefined;
  reload(): Promise<void>;

  createIdea(input: CaptureInput): string;
  updateIdea(id: string, patch: IdeaPatch): void;
  deleteIdea(id: string): void;
  restoreIdea(id: string): void;
  markViewed(id: string): void;
  setIdeaTags(id: string, names: string[]): void;
  setIdeaSource(id: string, opts: { sourceId?: string | null; newSource?: NewSourceInput | null }): void;
  toggleIdeaTopic(ideaId: string, topicId: string): void;
  toggleIdeaProject(ideaId: string, projectId: string): void;

  connect(a: string, b: string, relationship: RelationshipType | null, note?: string | null): void;
  updateLink(id: string, patch: Partial<Pick<IdeaLink, "relationship_type" | "note">>): void;
  removeLink(id: string): void;

  addReflection(ideaId: string, content: string): void;
  deleteReflection(id: string): void;

  createSource(input: NewSourceInput): string;
  updateSource(id: string, patch: Partial<Omit<Source, "id" | "created_at" | "is_sample">>): void;
  deleteSource(id: string): void;

  createTopic(name: string, description?: string | null): string;
  updateTopic(id: string, patch: Partial<Pick<Topic, "name" | "description">>): void;
  deleteTopic(id: string): void;

  createProject(name: string, description?: string | null): string;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description">>): void;
  deleteProject(id: string): void;

  renameTag(id: string, name: string): void;
  deleteTag(id: string): void;

  updateProfile(patch: Partial<Profile>): void;
  plantSamples(): Promise<void>;
  clearSamples(): Promise<void>;
  deleteEverything(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<LibraryValue | null>(null);

const SEED_ORDER: (keyof Snapshot)[] = [
  "sources",
  "topics",
  "tags",
  "projects",
  "ideas",
  "ideaTags",
  "ideaTopics",
  "ideaProjects",
  "links",
  "reflections",
];
const SNAP_TABLE = {
  sources: "sources",
  topics: "topics",
  tags: "tags",
  projects: "projects",
  ideas: "ideas",
  ideaTags: "idea_tags",
  ideaTopics: "idea_topics",
  ideaProjects: "idea_projects",
  links: "idea_links",
  reflections: "reflections",
} as const;

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

function derive(s: Snapshot): Derived {
  const ideaById = new Map(s.ideas.map((i) => [i.id, i]));
  const sourceById = new Map(s.sources.map((x) => [x.id, x]));
  const tagById = new Map(s.tags.map((x) => [x.id, x]));
  const topicById = new Map(s.topics.map((x) => [x.id, x]));
  const projectById = new Map(s.projects.map((x) => [x.id, x]));

  const sorted = [...s.ideas].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ideas = sorted.filter((i) => !i.archived);
  const archived = sorted.filter((i) => i.archived);
  const inbox = ideas.filter((i) => i.status === "inbox");

  const tagsByIdea = new Map<string, Tag[]>();
  const ideasByTag = new Map<string, string[]>();
  for (const it of s.ideaTags) {
    const t = tagById.get(it.tag_id);
    if (!t || !ideaById.has(it.idea_id)) continue;
    push(tagsByIdea, it.idea_id, t);
    push(ideasByTag, it.tag_id, it.idea_id);
  }
  for (const arr of tagsByIdea.values()) arr.sort((a, b) => a.name.localeCompare(b.name));

  const topicsByIdea = new Map<string, Topic[]>();
  const ideasByTopic = new Map<string, string[]>();
  for (const it of s.ideaTopics) {
    const t = topicById.get(it.topic_id);
    if (!t || !ideaById.has(it.idea_id)) continue;
    push(topicsByIdea, it.idea_id, t);
    push(ideasByTopic, it.topic_id, it.idea_id);
  }

  const projectsByIdea = new Map<string, Project[]>();
  const ideasByProject = new Map<string, string[]>();
  for (const it of s.ideaProjects) {
    const p = projectById.get(it.project_id);
    if (!p || !ideaById.has(it.idea_id)) continue;
    push(projectsByIdea, it.idea_id, p);
    push(ideasByProject, it.project_id, it.idea_id);
  }

  const ideasBySource = new Map<string, string[]>();
  for (const i of sorted) if (i.source_id) push(ideasBySource, i.source_id, i.id);

  const reflectionsByIdea = new Map<string, Reflection[]>();
  for (const r of [...s.reflections].sort((a, b) => b.created_at.localeCompare(a.created_at)))
    push(reflectionsByIdea, r.idea_id, r);

  // Titles resolve wiki links. Explicit titles win over derived first sentences.
  const titleIndex = new Map<string, string>();
  for (const i of sorted) {
    const d = normalize(displayTitle(i));
    if (!i.title?.trim() && !titleIndex.has(d)) titleIndex.set(d, i.id);
  }
  for (const i of sorted) if (i.title?.trim()) titleIndex.set(normalize(i.title), i.id);

  const connections = new Map<string, Connection[]>();
  const backlinks = new Map<string, { ideas: string[]; projects: string[] }>();
  const unresolved = new Map<string, string[]>();
  const pairSeen = new Set<string>();
  const edges: Edge[] = [];
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const bl = (id: string) => {
    let v = backlinks.get(id);
    if (!v) backlinks.set(id, (v = { ideas: [], projects: [] }));
    return v;
  };

  for (const l of s.links) {
    if (!ideaById.has(l.source_idea_id) || !ideaById.has(l.target_idea_id)) continue;
    push(connections, l.source_idea_id, {
      otherId: l.target_idea_id,
      kind: "link",
      outgoing: true,
      relationship: l.relationship_type,
      linkId: l.id,
      created_at: l.created_at,
    });
    push(connections, l.target_idea_id, {
      otherId: l.source_idea_id,
      kind: "link",
      outgoing: false,
      relationship: l.relationship_type,
      linkId: l.id,
      created_at: l.created_at,
    });
    const k = pairKey(l.source_idea_id, l.target_idea_id);
    if (!pairSeen.has(k)) {
      pairSeen.add(k);
      edges.push({ a: l.source_idea_id, b: l.target_idea_id, kind: "link", relationship: l.relationship_type });
    }
  }

  for (const i of s.ideas) {
    const refs = [...parseWikiLinks(i.content), ...parseWikiLinks(i.personal_thoughts)];
    const seen = new Set<string>();
    for (const r of refs) {
      const target = titleIndex.get(normalize(r.target));
      if (!target) {
        push(unresolved, i.id, r.target);
        continue;
      }
      if (target === i.id || seen.has(target)) continue;
      seen.add(target);
      bl(target).ideas.push(i.id);
      const k = pairKey(i.id, target);
      if (pairSeen.has(k)) continue;
      pairSeen.add(k);
      push(connections, i.id, { otherId: target, kind: "wiki", outgoing: true, relationship: null });
      push(connections, target, { otherId: i.id, kind: "wiki", outgoing: false, relationship: null });
      edges.push({ a: i.id, b: target, kind: "wiki", relationship: null });
    }
  }
  for (const p of s.projects) {
    const seen = new Set<string>();
    for (const r of parseWikiLinks(p.description)) {
      const target = titleIndex.get(normalize(r.target));
      if (target && !seen.has(target)) {
        seen.add(target);
        bl(target).projects.push(p.id);
      }
    }
  }

  const degree = new Map<string, number>();
  for (const [id, cs] of connections) degree.set(id, new Set(cs.map((c) => c.otherId)).size);

  const records: SearchRecord[] = sorted.map((i) => {
    const src = i.source_id ? sourceById.get(i.source_id) : undefined;
    return {
      idea: i,
      title: displayTitle(i).toLowerCase(),
      content: toRecordText(i.content),
      thoughts: toRecordText(i.personal_thoughts),
      tags: (tagsByIdea.get(i.id) ?? []).map((t) => t.name.toLowerCase()),
      topics: (topicsByIdea.get(i.id) ?? []).map((t) => t.name.toLowerCase()),
      sourceTitle: (src?.title ?? "").toLowerCase(),
      author: (src?.author ?? "").toLowerCase(),
      reflections: (reflectionsByIdea.get(i.id) ?? []).map((r) => r.content.toLowerCase()).join(" "),
    };
  });

  const similarity = buildIndex(
    ideas.map((i) => ({
      id: i.id,
      text: `${displayTitle(i)}. ${displayTitle(i)}. ${i.content} ${i.personal_thoughts ?? ""}`,
      boosts: [
        ...(tagsByIdea.get(i.id) ?? []).map((t) => t.name),
        ...(topicsByIdea.get(i.id) ?? []).map((t) => t.name),
      ],
    }))
  );

  const activeIds = new Set(ideas.map((i) => i.id));
  const clusters = communities(
    ideas.map((i) => i.id),
    edges.filter((e) => activeIds.has(e.a) && activeIds.has(e.b))
  );

  const topicOrder = new Map(
    [...s.topics].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((t, i) => [t.id, i])
  );

  return {
    ideas,
    archived,
    inbox,
    ideaById,
    sourceById,
    tagById,
    topicById,
    projectById,
    tagsByIdea,
    topicsByIdea,
    projectsByIdea,
    ideasByTag,
    ideasByTopic,
    ideasByProject,
    ideasBySource,
    reflectionsByIdea,
    titleIndex,
    connections,
    backlinks,
    unresolved,
    degree,
    edges,
    records,
    similarity,
    clusters,
    topicOrder,
  };
}

function removeIdeasFrom(s: Snapshot, ids: Set<string>): Snapshot {
  return {
    ...s,
    ideas: s.ideas.filter((i) => !ids.has(i.id)),
    ideaTags: s.ideaTags.filter((x) => !ids.has(x.idea_id)),
    ideaTopics: s.ideaTopics.filter((x) => !ids.has(x.idea_id)),
    ideaProjects: s.ideaProjects.filter((x) => !ids.has(x.idea_id)),
    reflections: s.reflections.filter((x) => !ids.has(x.idea_id)),
    links: s.links.filter((l) => !ids.has(l.source_idea_id) && !ids.has(l.target_idea_id)),
  };
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => (typeof window === "undefined" ? null : getRepo()), []);
  const toast = useToast();
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const dataRef = useRef<Snapshot>(data);
  const [profile, setProfile] = useState<Profile>({ display_name: null, theme: "system", seeded: true });
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<LibraryValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const seeding = useRef(false);

  const mutate = useCallback((fn: (s: Snapshot) => Snapshot) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
  }, []);

  const inflight = useRef<Promise<void> | null>(null);
  const reload = useCallback((): Promise<void> => {
    if (!repo) return Promise.resolve();
    if (inflight.current) return inflight.current;
    const run = (async () => {
      try {
        const res = await repo.load();
        let snapshot = res.snapshot;
        let prof = res.profile;
        if (!prof.seeded && snapshot.ideas.length === 0 && !seeding.current) {
          // First launch: plant a small sample garden so nothing starts empty.
          seeding.current = true;
          snapshot = buildSeed();
          for (const key of SEED_ORDER) {
            await repo.insert(SNAP_TABLE[key as keyof typeof SNAP_TABLE], snapshot[key] as unknown as Record<string, unknown>[]);
          }
          prof = { ...prof, seeded: true };
          await repo.updateProfile({ seeded: true });
        }
        dataRef.current = snapshot;
        setData(snapshot);
        setProfile(prof);
        setEmail(res.email);
        setStatus("ready");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your garden.");
        setStatus("error");
      }
    })().finally(() => {
      inflight.current = null;
    });
    inflight.current = run;
    return run;
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Run a persistence task; on failure, tell the person and resync from the server. */
  const persist = useCallback(
    (task: (r: Repo) => Promise<void>, failMessage = "That change wasn't saved") => {
      if (!repo) return;
      task(repo).catch((e) => {
        console.error(e);
        toast.show(`${failMessage}. ${e instanceof Error ? e.message : ""}`.trim(), { tone: "error" });
        void reload();
      });
    },
    [repo, toast, reload]
  );

  const derived = useMemo(() => derive(data), [data]);

  const resolveWiki = useCallback(
    (target: string) => {
      const id = derived.titleIndex.get(normalize(target));
      return id ? derived.ideaById.get(id) : undefined;
    },
    [derived]
  );

  // ---------------------------------------------------------------- helpers
  const ensureTags = useCallback((names: string[]) => {
    const s = dataRef.current;
    const byName = new Map(s.tags.map((t) => [t.name, t]));
    const created: Tag[] = [];
    const ids: string[] = [];
    for (const raw of names) {
      const name = normalizeTag(raw);
      if (!name) continue;
      let t = byName.get(name);
      if (!t) {
        t = { id: uid(), name, created_at: nowIso() };
        byName.set(name, t);
        created.push(t);
      }
      if (!ids.includes(t.id)) ids.push(t.id);
    }
    return { created, ids };
  }, []);

  const resolveSource = useCallback((input: NewSourceInput): { source: Source; created: boolean } => {
    const s = dataRef.current;
    const title = input.title.trim();
    const author = input.author?.trim() || null;
    const existing = s.sources.find(
      (x) => normalize(x.title) === normalize(title) && (!author || !x.author || normalize(x.author) === normalize(author))
    );
    if (existing) return { source: existing, created: false };
    return {
      created: true,
      source: {
        id: uid(),
        title,
        author,
        source_type: input.source_type,
        url: input.url?.trim() || null,
        publication_date: null,
        notes: null,
        is_sample: false,
        created_at: nowIso(),
      },
    };
  }, []);

  // ---------------------------------------------------------------- ideas
  const createIdea = useCallback<LibraryValue["createIdea"]>(
    (input) => {
      const now = nowIso();
      let source: Source | null = null;
      let newSource: Source | null = null;
      if (input.sourceId) source = dataRef.current.sources.find((x) => x.id === input.sourceId) ?? null;
      else if (input.newSource?.title?.trim()) {
        const r = resolveSource(input.newSource);
        source = r.source;
        if (r.created) newSource = r.source;
      }
      const { created: newTags, ids: tagIds } = ensureTags(input.tags ?? []);
      const idea: Idea = {
        id: uid(),
        title: input.title?.trim() || null,
        content: input.content.trim(),
        personal_thoughts: input.personal_thoughts?.trim() || null,
        source_id: source?.id ?? null,
        source_location: input.source_location?.trim() || null,
        status: input.status ?? "active",
        favorite: false,
        archived: false,
        is_sample: false,
        created_at: now,
        updated_at: now,
        last_viewed_at: now,
      };
      const ideaTags = tagIds.map((tag_id) => ({ idea_id: idea.id, tag_id, created_at: now }));
      const ideaTopics = (input.topicIds ?? []).map((topic_id) => ({ idea_id: idea.id, topic_id, created_at: now }));
      const ideaProjects = (input.projectIds ?? []).map((project_id) => ({ idea_id: idea.id, project_id, created_at: now }));

      mutate((s) => ({
        ...s,
        sources: newSource ? [...s.sources, newSource] : s.sources,
        tags: [...s.tags, ...newTags],
        ideas: [...s.ideas, idea],
        ideaTags: [...s.ideaTags, ...ideaTags],
        ideaTopics: [...s.ideaTopics, ...ideaTopics],
        ideaProjects: [...s.ideaProjects, ...ideaProjects],
      }));
      persist(async (r) => {
        await Promise.all([
          newSource ? r.insert("sources", [newSource as unknown as Record<string, unknown>]) : null,
          r.insert("tags", newTags as unknown as Record<string, unknown>[]),
        ]);
        await r.insert("ideas", [idea as unknown as Record<string, unknown>]);
        await Promise.all([
          r.insert("idea_tags", ideaTags),
          r.insert("idea_topics", ideaTopics),
          r.insert("idea_projects", ideaProjects),
        ]);
      }, "The idea wasn't saved");
      return idea.id;
    },
    [ensureTags, resolveSource, mutate, persist]
  );

  const updateIdea = useCallback<LibraryValue["updateIdea"]>(
    (id, patch) => {
      const before = dataRef.current.ideas.find((i) => i.id === id);
      if (!before) return;
      const writing = ["title", "content", "personal_thoughts", "source_id", "source_location"].some(
        (k) => k in patch && patch[k as keyof IdeaPatch] !== before[k as keyof Idea]
      );
      const after: Idea = { ...before, ...patch, updated_at: writing ? nowIso() : before.updated_at };
      const oldTitle = displayTitle(before);
      const newTitle = displayTitle(after);

      // Keep [[wiki links]] pointing at this idea when its title changes.
      const ideaUpdates: { id: string; patch: Partial<Idea> }[] = [];
      const projectUpdates: { id: string; patch: Partial<Project> }[] = [];
      if ("title" in patch && oldTitle !== newTitle && newTitle !== "Untitled idea") {
        for (const other of dataRef.current.ideas) {
          if (other.id === id) continue;
          const c = renameWikiTarget(other.content, oldTitle, newTitle);
          const t = other.personal_thoughts ? renameWikiTarget(other.personal_thoughts, oldTitle, newTitle) : other.personal_thoughts;
          if (c !== other.content || t !== other.personal_thoughts)
            ideaUpdates.push({ id: other.id, patch: { content: c, personal_thoughts: t } });
        }
        for (const p of dataRef.current.projects) {
          const d = p.description ? renameWikiTarget(p.description, oldTitle, newTitle) : p.description;
          if (d !== p.description) projectUpdates.push({ id: p.id, patch: { description: d } });
        }
      }

      mutate((s) => ({
        ...s,
        ideas: s.ideas.map((i) => {
          if (i.id === id) return after;
          const u = ideaUpdates.find((x) => x.id === i.id);
          return u ? { ...i, ...u.patch } : i;
        }),
        projects: s.projects.map((p) => {
          const u = projectUpdates.find((x) => x.id === p.id);
          return u ? { ...p, ...u.patch } : p;
        }),
      }));
      persist(async (r) => {
        await r.update("ideas", id, { ...patch, ...(writing ? { updated_at: after.updated_at } : {}) });
        await Promise.all([
          ...ideaUpdates.map((u) => r.update("ideas", u.id, u.patch)),
          ...projectUpdates.map((u) => r.update("projects", u.id, u.patch)),
        ]);
      });
    },
    [mutate, persist]
  );

  const deleteIdea = useCallback<LibraryValue["deleteIdea"]>(
    (id) => {
      mutate((s) => removeIdeasFrom(s, new Set([id])));
      persist((r) => r.remove("ideas", { id }), "The idea wasn't deleted");
    },
    [mutate, persist]
  );

  const restoreIdea = useCallback<LibraryValue["restoreIdea"]>((id) => updateIdea(id, { archived: false }), [updateIdea]);

  const markViewed = useCallback<LibraryValue["markViewed"]>(
    (id) => {
      const now = nowIso();
      mutate((s) => ({ ...s, ideas: s.ideas.map((i) => (i.id === id ? { ...i, last_viewed_at: now } : i)) }));
      repo?.update("ideas", id, { last_viewed_at: now }).catch(() => {});
    },
    [mutate, repo]
  );

  const setIdeaTags = useCallback<LibraryValue["setIdeaTags"]>(
    (id, names) => {
      const { created, ids } = ensureTags(names);
      const current = dataRef.current.ideaTags.filter((x) => x.idea_id === id).map((x) => x.tag_id);
      const add = ids.filter((t) => !current.includes(t));
      const remove = current.filter((t) => !ids.includes(t));
      const now = nowIso();
      const addRows = add.map((tag_id) => ({ idea_id: id, tag_id, created_at: now }));
      mutate((s) => ({
        ...s,
        tags: [...s.tags, ...created],
        ideaTags: [...s.ideaTags.filter((x) => !(x.idea_id === id && remove.includes(x.tag_id))), ...addRows],
      }));
      persist(async (r) => {
        await r.insert("tags", created as unknown as Record<string, unknown>[]);
        await Promise.all([
          r.insert("idea_tags", addRows),
          ...remove.map((tag_id) => r.remove("idea_tags", { idea_id: id, tag_id })),
        ]);
      });
    },
    [ensureTags, mutate, persist]
  );

  const setIdeaSource = useCallback<LibraryValue["setIdeaSource"]>(
    (id, opts) => {
      let sourceId: string | null = opts.sourceId ?? null;
      let created: Source | null = null;
      if (!sourceId && opts.newSource?.title?.trim()) {
        const r = resolveSource(opts.newSource);
        sourceId = r.source.id;
        if (r.created) created = r.source;
      }
      if (created) {
        const c = created;
        mutate((s) => ({ ...s, sources: [...s.sources, c] }));
        persist(async (r) => {
          await r.insert("sources", [c as unknown as Record<string, unknown>]);
          await r.update("ideas", id, { source_id: sourceId });
        });
        mutate((s) => ({ ...s, ideas: s.ideas.map((i) => (i.id === id ? { ...i, source_id: sourceId, updated_at: nowIso() } : i)) }));
      } else {
        updateIdea(id, { source_id: sourceId });
      }
    },
    [resolveSource, mutate, persist, updateIdea]
  );

  const toggleJoin = useCallback(
    (table: "idea_topics" | "idea_projects", key: "ideaTopics" | "ideaProjects", col: "topic_id" | "project_id", ideaId: string, otherId: string) => {
      const rows = dataRef.current[key] as { idea_id: string; created_at: string; topic_id?: string; project_id?: string }[];
      const exists = rows.some((x) => x.idea_id === ideaId && x[col] === otherId);
      if (exists) {
        mutate((s) => ({
          ...s,
          [key]: (s[key] as typeof rows).filter((x) => !(x.idea_id === ideaId && x[col] === otherId)),
        }));
        persist((r) => r.remove(table, { idea_id: ideaId, [col]: otherId }));
      } else {
        const row = { idea_id: ideaId, [col]: otherId, created_at: nowIso() };
        mutate((s) => ({ ...s, [key]: [...(s[key] as typeof rows), row] }));
        persist((r) => r.insert(table, [row]));
      }
    },
    [mutate, persist]
  );

  const toggleIdeaTopic = useCallback<LibraryValue["toggleIdeaTopic"]>(
    (ideaId, topicId) => toggleJoin("idea_topics", "ideaTopics", "topic_id", ideaId, topicId),
    [toggleJoin]
  );
  const toggleIdeaProject = useCallback<LibraryValue["toggleIdeaProject"]>(
    (ideaId, projectId) => toggleJoin("idea_projects", "ideaProjects", "project_id", ideaId, projectId),
    [toggleJoin]
  );

  // ---------------------------------------------------------------- links
  const connect = useCallback<LibraryValue["connect"]>(
    (a, b, relationship, note) => {
      if (a === b) return;
      const existing = dataRef.current.links.find(
        (l) => (l.source_idea_id === a && l.target_idea_id === b) || (l.source_idea_id === b && l.target_idea_id === a)
      );
      if (existing) {
        mutate((s) => ({
          ...s,
          links: s.links.map((l) => (l.id === existing.id ? { ...l, relationship_type: relationship, note: note ?? l.note } : l)),
        }));
        persist((r) => r.update("idea_links", existing.id, { relationship_type: relationship, ...(note !== undefined ? { note } : {}) }));
        return;
      }
      const link: IdeaLink = {
        id: uid(),
        source_idea_id: a,
        target_idea_id: b,
        relationship_type: relationship,
        note: note ?? null,
        created_at: nowIso(),
      };
      mutate((s) => ({ ...s, links: [...s.links, link] }));
      persist((r) => r.insert("idea_links", [link as unknown as Record<string, unknown>]), "The connection wasn't saved");
    },
    [mutate, persist]
  );

  const updateLink = useCallback<LibraryValue["updateLink"]>(
    (id, patch) => {
      mutate((s) => ({ ...s, links: s.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
      persist((r) => r.update("idea_links", id, patch));
    },
    [mutate, persist]
  );

  const removeLink = useCallback<LibraryValue["removeLink"]>(
    (id) => {
      mutate((s) => ({ ...s, links: s.links.filter((l) => l.id !== id) }));
      persist((r) => r.remove("idea_links", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- reflections
  const addReflection = useCallback<LibraryValue["addReflection"]>(
    (ideaId, content) => {
      const text = content.trim();
      if (!text) return;
      const row: Reflection = { id: uid(), idea_id: ideaId, content: text, created_at: nowIso() };
      mutate((s) => ({ ...s, reflections: [...s.reflections, row] }));
      persist((r) => r.insert("reflections", [row as unknown as Record<string, unknown>]), "The reflection wasn't saved");
    },
    [mutate, persist]
  );
  const deleteReflection = useCallback<LibraryValue["deleteReflection"]>(
    (id) => {
      mutate((s) => ({ ...s, reflections: s.reflections.filter((r) => r.id !== id) }));
      persist((r) => r.remove("reflections", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- sources
  const createSource = useCallback<LibraryValue["createSource"]>(
    (input) => {
      const { source, created } = resolveSource(input);
      if (created) {
        mutate((s) => ({ ...s, sources: [...s.sources, source] }));
        persist((r) => r.insert("sources", [source as unknown as Record<string, unknown>]));
      }
      return source.id;
    },
    [resolveSource, mutate, persist]
  );
  const updateSource = useCallback<LibraryValue["updateSource"]>(
    (id, patch) => {
      mutate((s) => ({ ...s, sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      persist((r) => r.update("sources", id, patch as Record<string, unknown>));
    },
    [mutate, persist]
  );
  const deleteSource = useCallback<LibraryValue["deleteSource"]>(
    (id) => {
      mutate((s) => ({
        ...s,
        sources: s.sources.filter((x) => x.id !== id),
        ideas: s.ideas.map((i) => (i.source_id === id ? { ...i, source_id: null } : i)),
      }));
      persist((r) => r.remove("sources", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- topics
  const createTopic = useCallback<LibraryValue["createTopic"]>(
    (name, description) => {
      const clean = name.trim();
      const existing = dataRef.current.topics.find((t) => normalize(t.name) === normalize(clean));
      if (existing) return existing.id;
      const topic: Topic = { id: uid(), name: clean, description: description?.trim() || null, is_sample: false, created_at: nowIso() };
      mutate((s) => ({ ...s, topics: [...s.topics, topic] }));
      persist((r) => r.insert("topics", [topic as unknown as Record<string, unknown>]), "The topic wasn't created");
      return topic.id;
    },
    [mutate, persist]
  );
  const updateTopic = useCallback<LibraryValue["updateTopic"]>(
    (id, patch) => {
      mutate((s) => ({ ...s, topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      persist((r) => r.update("topics", id, patch));
    },
    [mutate, persist]
  );
  const deleteTopic = useCallback<LibraryValue["deleteTopic"]>(
    (id) => {
      mutate((s) => ({ ...s, topics: s.topics.filter((t) => t.id !== id), ideaTopics: s.ideaTopics.filter((x) => x.topic_id !== id) }));
      persist((r) => r.remove("topics", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- projects
  const createProject = useCallback<LibraryValue["createProject"]>(
    (name, description) => {
      const now = nowIso();
      const project: Project = { id: uid(), name: name.trim(), description: description?.trim() || null, is_sample: false, created_at: now, updated_at: now };
      mutate((s) => ({ ...s, projects: [...s.projects, project] }));
      persist((r) => r.insert("projects", [project as unknown as Record<string, unknown>]), "The project wasn't created");
      return project.id;
    },
    [mutate, persist]
  );
  const updateProject = useCallback<LibraryValue["updateProject"]>(
    (id, patch) => {
      const p = { ...patch, updated_at: nowIso() };
      mutate((s) => ({ ...s, projects: s.projects.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
      persist((r) => r.update("projects", id, p));
    },
    [mutate, persist]
  );
  const deleteProject = useCallback<LibraryValue["deleteProject"]>(
    (id) => {
      mutate((s) => ({ ...s, projects: s.projects.filter((x) => x.id !== id), ideaProjects: s.ideaProjects.filter((x) => x.project_id !== id) }));
      persist((r) => r.remove("projects", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- tags
  const renameTag = useCallback<LibraryValue["renameTag"]>(
    (id, name) => {
      const clean = normalizeTag(name);
      if (!clean) return;
      if (dataRef.current.tags.some((t) => t.name === clean && t.id !== id)) {
        toast.show(`A tag called “${clean}” already exists.`, { tone: "error" });
        return;
      }
      mutate((s) => ({ ...s, tags: s.tags.map((t) => (t.id === id ? { ...t, name: clean } : t)) }));
      persist((r) => r.update("tags", id, { name: clean }));
    },
    [mutate, persist, toast]
  );
  const deleteTag = useCallback<LibraryValue["deleteTag"]>(
    (id) => {
      mutate((s) => ({ ...s, tags: s.tags.filter((t) => t.id !== id), ideaTags: s.ideaTags.filter((x) => x.tag_id !== id) }));
      persist((r) => r.remove("tags", { id }));
    },
    [mutate, persist]
  );

  // ---------------------------------------------------------------- profile & housekeeping
  const updateProfile = useCallback<LibraryValue["updateProfile"]>(
    (patch) => {
      setProfile((p) => ({ ...p, ...patch }));
      persist((r) => r.updateProfile(patch), "Settings weren't saved");
    },
    [persist]
  );

  const plantSamples = useCallback(async () => {
    if (!repo) return;
    const seed = buildSeed();
    const existingTags = new Map(dataRef.current.tags.map((t) => [t.name, t.id]));
    // Reuse tags the person already has instead of duplicating names.
    const remap = new Map<string, string>();
    seed.tags = seed.tags.filter((t) => {
      const had = existingTags.get(t.name);
      if (had) remap.set(t.id, had);
      return !had;
    });
    seed.ideaTags = seed.ideaTags.map((x) => ({ ...x, tag_id: remap.get(x.tag_id) ?? x.tag_id }));
    const existingTopics = new Map(dataRef.current.topics.map((t) => [normalize(t.name), t.id]));
    const topicRemap = new Map<string, string>();
    seed.topics = seed.topics.filter((t) => {
      const had = existingTopics.get(normalize(t.name));
      if (had) topicRemap.set(t.id, had);
      return !had;
    });
    seed.ideaTopics = seed.ideaTopics.map((x) => ({ ...x, topic_id: topicRemap.get(x.topic_id) ?? x.topic_id }));
    try {
      for (const key of SEED_ORDER) {
        await repo.insert(SNAP_TABLE[key as keyof typeof SNAP_TABLE], seed[key] as unknown as Record<string, unknown>[]);
      }
      await reload();
      toast.show("Sample garden planted.");
    } catch (e) {
      toast.show(`Sample ideas weren't added. ${e instanceof Error ? e.message : ""}`, { tone: "error" });
      void reload();
    }
  }, [repo, reload, toast]);

  const clearSamples = useCallback(async () => {
    if (!repo) return;
    const s = dataRef.current;
    const ideaIds = s.ideas.filter((i) => i.is_sample).map((i) => i.id);
    const sourceIds = s.sources.filter((x) => x.is_sample && !s.ideas.some((i) => !i.is_sample && i.source_id === x.id)).map((x) => x.id);
    const topicIds = s.topics.filter((x) => x.is_sample && !s.ideaTopics.some((j) => j.topic_id === x.id && !ideaIds.includes(j.idea_id))).map((x) => x.id);
    const projectIds = s.projects.filter((x) => x.is_sample).map((x) => x.id);
    const idSet = new Set(ideaIds);
    const usedTags = new Set(s.ideaTags.filter((x) => !idSet.has(x.idea_id)).map((x) => x.tag_id));
    const tagIds = s.tags.filter((t) => !usedTags.has(t.id)).map((t) => t.id);
    try {
      await repo.removeIn("ideas", "id", ideaIds);
      await Promise.all([
        repo.removeIn("sources", "id", sourceIds),
        repo.removeIn("topics", "id", topicIds),
        repo.removeIn("projects", "id", projectIds),
        repo.removeIn("tags", "id", tagIds),
      ]);
      await reload();
      toast.show("Sample ideas removed.");
    } catch (e) {
      toast.show(`Sample ideas weren't removed. ${e instanceof Error ? e.message : ""}`, { tone: "error" });
      void reload();
    }
  }, [repo, reload, toast]);

  const deleteEverything = useCallback(async () => {
    if (!repo) return;
    try {
      await repo.deleteEverything();
      await reload();
      toast.show("Your garden is empty.");
    } catch (e) {
      toast.show(`Nothing was deleted. ${e instanceof Error ? e.message : ""}`, { tone: "error" });
    }
  }, [repo, reload, toast]);

  const signOut = useCallback(async () => {
    await repo?.signOut();
    window.location.href = "/login";
  }, [repo]);

  const value: LibraryValue = {
    ...derived,
    status,
    error,
    mode: repo?.mode ?? "local",
    email,
    profile,
    data,
    resolveWiki,
    reload,
    createIdea,
    updateIdea,
    deleteIdea,
    restoreIdea,
    markViewed,
    setIdeaTags,
    setIdeaSource,
    toggleIdeaTopic,
    toggleIdeaProject,
    connect,
    updateLink,
    removeLink,
    addReflection,
    deleteReflection,
    createSource,
    updateSource,
    deleteSource,
    createTopic,
    updateTopic,
    deleteTopic,
    createProject,
    updateProject,
    deleteProject,
    renameTag,
    deleteTag,
    updateProfile,
    plantSamples,
    clearSamples,
    deleteEverything,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLibrary must be used inside LibraryProvider");
  return ctx;
}
