"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ellipsis,
  Inbox,
  Link2,
  Maximize2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { Markdown } from "@/components/markdown";
import { WikiEditor } from "@/components/wiki-editor";
import { draftFromSource, SourceFields, TagInput, type SourceDraft } from "@/components/fields";
import { GrowthMark, SourceLine, growthStage } from "@/components/idea-bits";
import { callAI } from "@/lib/ai-client";
import { similarityLabel } from "@/lib/similarity";
import { cx, displayTitle, firstSentence, formatDate, previewText, relativeDays, relativeTime } from "@/lib/text";
import { RELATIONSHIPS, relationshipLabel, sourceTypeLabel, type Connection, type RelationshipType } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

function useDebounced(fn: (v: string) => void, delay = 650) {
  const latest = useRef(fn);
  latest.current = fn;
  const api = useRef<{ call(v: string): void; flush(): void } | null>(null);
  if (!api.current) {
    let timer: number | undefined;
    // Remember which save function (and so which idea) each pending value belongs to.
    let pending: { v: string; fn: (v: string) => void } | null = null;
    const flush = () => {
      window.clearTimeout(timer);
      if (pending) {
        const p = pending;
        pending = null;
        p.fn(p.v);
      }
    };
    api.current = {
      call(v: string) {
        pending = { v, fn: latest.current };
        window.clearTimeout(timer);
        timer = window.setTimeout(flush, delay);
      },
      flush,
    };
  }
  useEffect(() => () => api.current?.flush(), []);
  return api.current;
}

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h2 className="font-serif text-[1.0625rem] font-medium text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SavedState({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "idle") return null;
  return <span className="text-xs text-faint">{state === "saving" ? "Saving…" : "Saved"}</span>;
}

export default function IdeaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const idea = lib.ideaById.get(id);
  useTitle(idea ? displayTitle(idea) : "Idea");

  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (idea && viewed.current !== id) {
      viewed.current = id;
      lib.markViewed(id);
    }
  }, [id, idea, lib]);

  const [title, setTitle] = useState(idea?.title ?? "");
  const [content, setContent] = useState(idea?.content ?? "");
  const [thoughts, setThoughts] = useState(idea?.personal_thoughts ?? "");
  const [editing, setEditing] = useState<null | "content" | "thoughts">(null);
  const [focus, setFocus] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [menu, setMenu] = useState(false);
  const [editSource, setEditSource] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<SourceDraft | null>(null);
  const [reflection, setReflection] = useState("");
  const [addingTo, setAddingTo] = useState<null | "topic" | "project">(null);
  const [newName, setNewName] = useState("");
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done" | "error"; items: { id: string; strength: string; reason: string }[]; error?: string }>({ state: "idle", items: [] });

  // Reset local editing state when navigating between ideas.
  useEffect(() => {
    const i = lib.ideaById.get(id);
    setTitle(i?.title ?? "");
    setContent(i?.content ?? "");
    setThoughts(i?.personal_thoughts ?? "");
    setEditing(null);
    setEditSource(false);
    setAi({ state: "idle", items: [] });
    setSaved("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pick up changes made elsewhere (e.g. a renamed wiki link) when not editing.
  useEffect(() => {
    if (!idea) return;
    if (editing !== "content") setContent(idea.content);
    if (editing !== "thoughts") setThoughts(idea.personal_thoughts ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea?.content, idea?.personal_thoughts]);

  const markSaved = () => {
    setSaved("saved");
    window.setTimeout(() => setSaved((s) => (s === "saved" ? "idle" : s)), 1600);
  };
  const saveTitle = useDebounced((v) => {
    lib.updateIdea(id, { title: v.trim() || null });
    markSaved();
  });
  const saveContent = useDebounced((v) => {
    if (v.trim()) {
      lib.updateIdea(id, { content: v });
      markSaved();
    }
  });
  const saveThoughts = useDebounced((v) => {
    lib.updateIdea(id, { personal_thoughts: v.trim() ? v : null });
    markSaved();
  });

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        saveContent.flush();
        setFocus(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [focus, saveContent]);

  // "E" edits the idea when nothing else has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA"].includes(t.tagName)) return;
      if (ui.capture.open || ui.palette.open || ui.connectFor) return;
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setEditing("content");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui.capture.open, ui.palette.open, ui.connectFor]);

  const connections = useMemo(() => lib.connections.get(id) ?? [], [lib.connections, id]);
  const connectedIds = useMemo(() => new Set(connections.map((c) => c.otherId)), [connections]);
  const related = useMemo(() => lib.similarity.similar(id, 5, connectedIds).filter((r) => r.score >= 0.07), [lib.similarity, id, connectedIds]);
  const backlinks = lib.backlinks.get(id) ?? { ideas: [], projects: [] };
  const unresolved = [...new Set(lib.unresolved.get(id) ?? [])];

  if (!idea) {
    return (
      <Page>
        <h1 className="font-serif text-title">This idea isn&apos;t in your garden</h1>
        <p className="mt-2 text-stem">It may have been deleted, or the link is from someone else&apos;s library.</p>
        <Link href="/ideas" className="btn-quiet mt-5">
          Go to all ideas
        </Link>
      </Page>
    );
  }

  const source = idea.source_id ? lib.sourceById.get(idea.source_id) : undefined;
  const tags = (lib.tagsByIdea.get(id) ?? []).map((t) => t.name);
  const topics = lib.topicsByIdea.get(id) ?? [];
  const projects = lib.projectsByIdea.get(id) ?? [];
  const reflections = lib.reflectionsByIdea.get(id) ?? [];
  const degree = lib.degree.get(id) ?? 0;

  const derivedTitle = firstSentence(content || idea.content);

  const explicit = connections.filter((c) => c.kind === "link");
  const wikiLinks = connections.filter((c) => c.kind === "wiki");

  const runAI = async () => {
    setAi({ state: "loading", items: [] });
    try {
      const r = await callAI({ action: "suggest", ideaId: id }, lib.data);
      setAi({ state: "done", items: r.suggestions.filter((s) => lib.ideaById.has(s.id) && s.id !== id && !connectedIds.has(s.id)) });
    } catch (e) {
      setAi({ state: "error", items: [], error: e instanceof Error ? e.message : "No suggestions came back." });
    }
  };

  const remove = () => {
    if (!window.confirm("Delete this idea? Its connections and reflections will be removed too.")) return;
    lib.deleteIdea(id);
    toast.show("Idea deleted.");
    router.push("/ideas");
  };

  const archive = () => {
    lib.updateIdea(id, { archived: !idea.archived });
    toast.show(idea.archived ? "Restored to your ideas." : "Archived. Find it under All Ideas, Archived.", {
      action: idea.archived ? undefined : { label: "Undo", run: () => lib.updateIdea(id, { archived: false }) },
    });
    setMenu(false);
  };

  const ConnectionRow = ({ c }: { c: Connection }) => {
    const other = lib.ideaById.get(c.otherId);
    if (!other) return null;
    return (
      <li className="group flex items-start gap-3 py-2.5">
        <GrowthMark degree={lib.degree.get(other.id) ?? 0} className="mt-1.5" />
        <div className="min-w-0 flex-1">
          {c.kind === "link" ? (
            <label className="relative inline-flex items-center">
              <span className="sr-only">Relationship</span>
              <select
                value={c.relationship ?? ""}
                onChange={(e) => lib.updateLink(c.linkId!, { relationship_type: (e.target.value || null) as RelationshipType | null })}
                className={cx(
                  "cursor-pointer appearance-none rounded bg-transparent pr-1 text-sm hover:text-ink focus:outline-none",
                  c.relationship === "contradicts" ? "text-rust" : "text-stem"
                )}
              >
                <option value="">{c.outgoing ? "connects to" : "connected from"}</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {c.outgoing ? r.label : r.inverse}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-sm text-stem">{c.outgoing ? "mentioned in the text" : "mentions this idea"}</span>
          )}
          <Link href={`/ideas/${other.id}`} className="block font-serif text-[1.0625rem] leading-7 text-ink hover:text-juniper">
            {displayTitle(other)}
          </Link>
        </div>
        {c.kind === "link" && (
          <button
            className="mt-1 rounded p-1 text-faint opacity-0 transition-opacity hover:bg-sunk hover:text-ink focus:opacity-100 group-hover:opacity-100"
            onClick={() => lib.removeLink(c.linkId!)}
            aria-label={`Remove connection to ${displayTitle(other)}`}
            title="Remove connection"
          >
            <X size={14} />
          </button>
        )}
      </li>
    );
  };

  return (
    <Page>
      {/* Toolbar */}
      <div className="mb-8 flex items-center justify-between gap-2">
        <button onClick={() => (window.history.length > 1 ? router.back() : router.push("/ideas"))} className="btn-ghost -ml-3 h-8 px-2.5">
          <ArrowLeft size={15} strokeWidth={1.75} /> Back
        </button>
        <div className="flex items-center gap-1">
          <SavedState state={saved} />
          <button
            className="btn-ghost h-8 w-8 px-0"
            onClick={() => lib.updateIdea(id, { favorite: !idea.favorite })}
            aria-pressed={idea.favorite}
            aria-label={idea.favorite ? "Remove from favorites" : "Add to favorites"}
            title={idea.favorite ? "Favorite" : "Add to favorites"}
          >
            <Star size={16} strokeWidth={1.75} className={idea.favorite ? "fill-juniper text-juniper" : ""} />
          </button>
          <button className="btn-ghost h-8 w-8 px-0" onClick={() => setFocus(true)} aria-label="Focus mode" title="Focus mode">
            <Maximize2 size={15} strokeWidth={1.75} />
          </button>
          <div className="relative">
            <button className="btn-ghost h-8 w-8 px-0" onClick={() => setMenu((m) => !m)} aria-label="More actions" aria-expanded={menu}>
              <Ellipsis size={16} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-20 mt-1 w-52 animate-sprout overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
                  {idea.status === "active" ? (
                    <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-sunk" onClick={() => { lib.updateIdea(id, { status: "inbox" }); setMenu(false); }}>
                      <Inbox size={15} strokeWidth={1.75} /> Move to Inbox
                    </button>
                  ) : null}
                  <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-sunk" onClick={archive}>
                    {idea.archived ? <ArchiveRestore size={15} strokeWidth={1.75} /> : <Archive size={15} strokeWidth={1.75} />}
                    {idea.archived ? "Restore from archive" : "Archive"}
                  </button>
                  <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-rust hover:bg-rust/10" onClick={remove}>
                    <Trash2 size={15} strokeWidth={1.75} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {idea.status === "inbox" && !idea.archived && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-sheet px-4 py-3 text-sm">
          <span className="text-stem">In your Inbox. Add a source, tags or a connection, then keep it.</span>
          <button className="btn-quiet h-8" onClick={() => { lib.updateIdea(id, { status: "active" }); toast.show("Kept as an idea."); }}>
            Keep as idea
          </button>
        </div>
      )}
      {idea.archived && (
        <div className="mb-8 flex items-center justify-between gap-3 rounded-md border border-line bg-sunk px-4 py-3 text-sm">
          <span className="text-stem">Archived. It won&apos;t appear in lists, search or resurfacing.</span>
          <button className="btn-quiet h-8" onClick={archive}>
            Restore
          </button>
        </div>
      )}

      {/* Title */}
      <textarea
        value={title}
        rows={1}
        onChange={(e) => {
          setTitle(e.target.value.replace(/\n/g, ""));
          saveTitle.call(e.target.value.replace(/\n/g, ""));
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        onBlur={() => saveTitle.flush()}
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
        placeholder={derivedTitle || "Untitled idea"}
        aria-label="Title"
        className="block w-full overflow-hidden bg-transparent font-serif text-display font-medium tracking-[-0.015em] text-ink outline-none placeholder:text-ink/85 focus:placeholder:text-faint"
      />

      {/* The idea */}
      <div className="mt-5">
        {editing === "content" ? (
          <div className="-mx-4 rounded-md border border-juniper/30 bg-sheet px-4 py-3">
            <WikiEditor
              value={content}
              autoFocus
              excludeId={id}
              onChange={(v) => {
                setContent(v);
                setSaved("saving");
                saveContent.call(v);
              }}
              onSubmit={() => {
                saveContent.flush();
                setEditing(null);
              }}
              ariaLabel="Idea"
              placeholder="The idea, in your own words. Type [[ to link."
              className="prose-idea min-h-[6rem] text-lead leading-[2.05rem]"
            />
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <span className="text-xs text-faint">
                Markdown works. <span className="kbd">[[</span> links an idea. <span className="kbd">⌘↵</span> done.
              </span>
              <button className="btn-quiet h-7 px-2.5 text-xs" onClick={() => { saveContent.flush(); setEditing(null); }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div
            className="group relative -mx-4 cursor-text rounded-md px-4 py-1 transition-colors hover:bg-sheet/70"
            onDoubleClick={() => setEditing("content")}
          >
            <Markdown text={idea.content} className="text-lead leading-[2.05rem]" />
            <button
              className="absolute -right-2 top-1 rounded p-1.5 text-faint opacity-0 transition-opacity hover:bg-sunk hover:text-ink focus:opacity-100 group-hover:opacity-100"
              onClick={() => setEditing("content")}
              aria-label="Edit idea"
              title="Edit (E)"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Source */}
      <Block
        title="Source"
        action={
          !editSource && (
            <button
              className="text-sm text-stem hover:text-ink"
              onClick={() => {
                setSourceDraft(draftFromSource(source, idea.source_location));
                setEditSource(true);
              }}
            >
              {source ? "Change" : "Add source"}
            </button>
          )
        }
      >
        {editSource && sourceDraft ? (
          <div className="rounded-md border border-line bg-sheet p-4">
            <SourceFields draft={sourceDraft} onChange={setSourceDraft} />
            <div className="mt-4 flex justify-between gap-2">
              {source ? (
                <button
                  className="btn-danger h-8 px-2.5"
                  onClick={() => {
                    lib.updateIdea(id, { source_id: null, source_location: null });
                    setEditSource(false);
                  }}
                >
                  Remove source
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button className="btn-ghost h-8" onClick={() => setEditSource(false)}>
                  Cancel
                </button>
                <button
                  className="btn-primary h-8"
                  onClick={() => {
                    if (sourceDraft.sourceId) lib.setIdeaSource(id, { sourceId: sourceDraft.sourceId });
                    else if (sourceDraft.title.trim())
                      lib.setIdeaSource(id, { newSource: { title: sourceDraft.title, author: sourceDraft.author, source_type: sourceDraft.type } });
                    else lib.setIdeaSource(id, { sourceId: null });
                    lib.updateIdea(id, { source_location: sourceDraft.location.trim() || null });
                    setEditSource(false);
                  }}
                >
                  Save source
                </button>
              </div>
            </div>
          </div>
        ) : source ? (
          <div>
            <Link href={`/sources/${source.id}`} className="font-serif text-read italic text-ink hover:text-juniper">
              {source.title}
            </Link>
            <p className="text-stem">
              {[source.author, idea.source_location].filter(Boolean).join(", ")}
              {!source.author && !idea.source_location ? sourceTypeLabel(source.source_type) : ""}
            </p>
            {(lib.ideasBySource.get(source.id)?.length ?? 0) > 1 && (
              <p className="mt-1 text-sm text-faint">
                {(lib.ideasBySource.get(source.id)?.length ?? 1) - 1} other idea{(lib.ideasBySource.get(source.id)?.length ?? 0) > 2 ? "s" : ""} from this source
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-faint">No source. That&apos;s fine for your own observations.</p>
        )}
      </Block>

      {/* My thoughts */}
      <Block
        title="My thoughts"
        action={
          editing !== "thoughts" && (
            <button className="text-sm text-stem hover:text-ink" onClick={() => setEditing("thoughts")}>
              {idea.personal_thoughts ? "Edit" : "Write"}
            </button>
          )
        }
      >
        {editing === "thoughts" ? (
          <div className="rounded-md border border-juniper/30 bg-sheet px-4 py-3">
            <WikiEditor
              value={thoughts}
              autoFocus
              excludeId={id}
              onChange={(v) => {
                setThoughts(v);
                setSaved("saving");
                saveThoughts.call(v);
              }}
              onSubmit={() => {
                saveThoughts.flush();
                setEditing(null);
              }}
              ariaLabel="My thoughts"
              placeholder="What does this mean to you? Where does it apply?"
              className="prose-idea min-h-[4rem]"
            />
            <div className="mt-2 flex justify-end border-t border-line pt-2">
              <button className="btn-quiet h-7 px-2.5 text-xs" onClick={() => { saveThoughts.flush(); setEditing(null); }}>
                Done
              </button>
            </div>
          </div>
        ) : idea.personal_thoughts ? (
          <div className="cursor-text border-l-2 border-juniper/40 pl-4" onDoubleClick={() => setEditing("thoughts")}>
            <Markdown text={idea.personal_thoughts} />
          </div>
        ) : (
          <button onClick={() => setEditing("thoughts")} className="text-left text-sm text-faint hover:text-stem">
            Your interpretation is what makes an idea yours. Where might this apply?
          </button>
        )}

        {reflections.length > 0 && (
          <ul className="mt-6 space-y-4">
            {reflections.map((r) => (
              <li key={r.id} className="group">
                <p className="text-xs text-faint">
                  Reflection, {formatDate(r.created_at)}
                  <button
                    className="ml-2 text-faint opacity-0 hover:text-rust focus:opacity-100 group-hover:opacity-100"
                    onClick={() => lib.deleteReflection(r.id)}
                  >
                    Delete
                  </button>
                </p>
                <Markdown text={r.content} className="mt-0.5 !text-base !leading-7 text-ink/90" />
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-5 flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reflection.trim()) return;
            lib.addReflection(id, reflection);
            setReflection("");
          }}
        >
          <input
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="Add a dated reflection"
            className="field h-9 py-1 text-sm"
            aria-label="New reflection"
          />
          <button className="btn-quiet h-9" disabled={!reflection.trim()}>
            Add
          </button>
        </form>
      </Block>

      {/* Tags, topics, projects */}
      <Block title="Tags and topics">
        <TagInput value={tags} onChange={(v) => lib.setIdeaTags(id, v)} placeholder="Add tags" />
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {topics.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pl-2.5 pr-1 text-sm">
              <Link href={`/topics/${t.id}`} className="text-ink hover:text-juniper">
                {t.name}
              </Link>
              <button className="rounded-full p-0.5 text-faint hover:text-ink" onClick={() => lib.toggleIdeaTopic(id, t.id)} aria-label={`Remove from ${t.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          {projects.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line py-0.5 pl-2.5 pr-1 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-faint" />
              <Link href={`/projects/${p.id}`} className="text-ink hover:text-juniper">
                {p.name}
              </Link>
              <button className="rounded-full p-0.5 text-faint hover:text-ink" onClick={() => lib.toggleIdeaProject(id, p.id)} aria-label={`Remove from ${p.name}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="relative">
            <button className="btn-ghost h-7 px-2 text-sm" onClick={() => setAddingTo(addingTo ? null : "topic")}>
              <Plus size={14} /> Topic or project
            </button>
            {addingTo && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddingTo(null)} />
                <div className="absolute left-0 z-20 mt-1 w-64 animate-sprout overflow-hidden rounded-md border border-line bg-sheet shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
                  <div className="flex border-b border-line text-sm">
                    {(["topic", "project"] as const).map((k) => (
                      <button key={k} className={cx("flex-1 py-2", addingTo === k ? "font-medium text-ink" : "text-stem")} onClick={() => setAddingTo(k)}>
                        {k === "topic" ? "Topics" : "Projects"}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
                    {(addingTo === "topic" ? lib.data.topics : lib.data.projects).map((x) => {
                      const on = addingTo === "topic" ? topics.some((t) => t.id === x.id) : projects.some((p) => p.id === x.id);
                      return (
                        <button
                          key={x.id}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-sunk"
                          onClick={() => (addingTo === "topic" ? lib.toggleIdeaTopic(id, x.id) : lib.toggleIdeaProject(id, x.id))}
                        >
                          <span>{x.name}</span>
                          {on && <span className="text-xs text-juniper">added</span>}
                        </button>
                      );
                    })}
                  </div>
                  <form
                    className="border-t border-line p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newName.trim()) return;
                      if (addingTo === "topic") lib.toggleIdeaTopic(id, lib.createTopic(newName));
                      else lib.toggleIdeaProject(id, lib.createProject(newName));
                      setNewName("");
                    }}
                  >
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={addingTo === "topic" ? "New topic" : "New project"} className="field h-8 py-1 text-sm" />
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </Block>

      {/* Connections */}
      <Block
        title="Connections"
        action={
          <button className="btn-quiet h-8" onClick={() => ui.openConnect(id)}>
            <Link2 size={14} strokeWidth={1.75} /> Connect
          </button>
        }
      >
        <p className="-mt-1 mb-2 flex items-center gap-2 text-sm text-stem">
          <GrowthMark degree={degree} /> {growthStage(degree).label}
        </p>
        {explicit.length || wikiLinks.length ? (
          <ul className="divide-y divide-line/60">
            {[...explicit, ...wikiLinks].map((c) => (
              <ConnectionRow key={`${c.kind}-${c.linkId ?? c.otherId}`} c={c} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">Connect this to something you already know. Type [[ in the idea, or use Connect.</p>
        )}
        {unresolved.length > 0 && (
          <p className="mt-3 text-sm text-stem">
            Links to ideas you haven&apos;t written yet:{" "}
            {unresolved.map((u, i) => (
              <span key={u}>
                {i > 0 && ", "}
                <button className="wikilink-missing" onClick={() => ui.openCapture({ title: u })}>
                  {u}
                </button>
              </span>
            ))}
          </p>
        )}
      </Block>

      {/* Backlinks */}
      <Block title="Linked from">
        {backlinks.ideas.length || backlinks.projects.length ? (
          <ul className="space-y-2">
            {backlinks.ideas.map((bid) => {
              const b = lib.ideaById.get(bid);
              if (!b) return null;
              return (
                <li key={bid}>
                  <Link href={`/ideas/${bid}`} className="font-serif text-[1.0625rem] text-ink hover:text-juniper">
                    {displayTitle(b)}
                  </Link>
                  <p className="line-clamp-1 text-sm text-stem">{previewText(b, 120)}</p>
                </li>
              );
            })}
            {backlinks.projects.map((pid) => {
              const p = lib.projectById.get(pid);
              if (!p) return null;
              return (
                <li key={pid} className="flex items-center gap-2">
                  <span className="text-sm text-faint">Project</span>
                  <Link href={`/projects/${pid}`} className="text-ink hover:text-juniper">
                    {p.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-faint">No other idea mentions this one yet. When one does with [[{displayTitle(idea)}]], it shows up here.</p>
        )}
      </Block>

      {/* Related */}
      <Block
        title="Related ideas"
        action={
          ui.ai.enabled &&
          ai.state !== "loading" && (
            <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink" onClick={runAI}>
              <Sparkles size={14} strokeWidth={1.75} /> Suggest by meaning
            </button>
          )
        }
      >
        {ai.state === "loading" && <p className="mb-3 text-sm text-stem">Reading your library…</p>}
        {ai.state === "error" && <p className="mb-3 text-sm text-rust">{ai.error}</p>}
        {ai.state === "done" && (
          <div className="mb-5">
            <p className="mb-1 text-sm text-stem">This may connect to:</p>
            {ai.items.length ? (
              <ul className="divide-y divide-line/60">
                {ai.items.map((s) => (
                  <SuggestionRow key={s.id} otherId={s.id} label={`Similarity: ${s.strength}`} reason={s.reason} onConnect={() => lib.connect(id, s.id, null)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">Nothing else in your library looks closely related.</p>
            )}
          </div>
        )}
        {related.length ? (
          <ul className="divide-y divide-line/60">
            {related.map((r) => (
              <SuggestionRow key={r.id} otherId={r.id} label={`Similarity: ${similarityLabel(r.score)}`} onConnect={() => lib.connect(id, r.id, null)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">Related ideas appear here as your garden grows.</p>
        )}
      </Block>

      <footer className="mt-14 space-y-0.5 text-xs text-faint">
        <p>
          Captured {formatDate(idea.created_at, { year: true })} ({relativeDays(idea.created_at)})
        </p>
        {idea.updated_at !== idea.created_at && <p>Edited {relativeTime(idea.updated_at)}</p>}
      </footer>

      {/* Focus mode */}
      {focus && (
        <div className="fixed inset-0 z-[55] flex animate-fade flex-col bg-paper">
          <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
            <span className="text-sm text-faint">{displayTitle(idea)}</span>
            <div className="flex items-center gap-3">
              <SavedState state={saved} />
              <button className="btn-quiet h-8" onClick={() => { saveContent.flush(); setFocus(false); }}>
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[38rem] px-5 py-[12vh] sm:px-8">
              <WikiEditor
                value={content}
                autoFocus
                excludeId={id}
                onChange={(v) => {
                  setContent(v);
                  setSaved("saving");
                  saveContent.call(v);
                }}
                ariaLabel="Idea"
                className="prose-idea min-h-[40vh] text-[1.3125rem] leading-[2.2rem]"
              />
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function SuggestionRow({ otherId, label, reason, onConnect }: { otherId: string; label: string; reason?: string; onConnect(): void }) {
  const lib = useLibrary();
  const other = lib.ideaById.get(otherId);
  if (!other) return null;
  return (
    <li className="flex items-start gap-3 py-2.5">
      <GrowthMark degree={lib.degree.get(otherId) ?? 0} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <Link href={`/ideas/${otherId}`} className="font-serif text-[1.0625rem] leading-7 text-ink hover:text-juniper">
          {displayTitle(other)}
        </Link>
        <p className="text-sm text-stem">
          {label}
          {reason ? `. ${reason}` : ""}
        </p>
      </div>
      <button className="btn-quiet h-7 shrink-0 px-2.5 text-xs" onClick={onConnect}>
        Connect
      </button>
    </li>
  );
}
