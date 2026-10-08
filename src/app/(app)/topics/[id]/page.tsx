"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { GraphView } from "@/components/graph-view";
import { AIAnswer } from "@/components/ai-answer";
import { Empty, IdeaRow, Section } from "@/components/idea-bits";
import { callAI } from "@/lib/ai-client";
import { searchIdeas } from "@/lib/search";
import { topicHue } from "@/lib/graph";
import { displayTitle, plural } from "@/lib/text";
import { useTitle } from "@/lib/use-title";

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const router = useRouter();
  const topic = lib.topicById.get(id);
  useTitle(topic?.name ?? "Topic");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [adding, setAdding] = useState("");
  const [summary, setSummary] = useState<{ state: "idle" | "loading" | "done" | "error"; text: string }>({ state: "idle", text: "" });
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const ideas = useMemo(
    () =>
      (lib.ideasByTopic.get(id) ?? [])
        .map((x) => lib.ideaById.get(x)!)
        .filter((i) => i && !i.archived)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [lib.ideasByTopic, lib.ideaById, id]
  );
  const ids = useMemo(() => new Set(ideas.map((i) => i.id)), [ideas]);

  const inside = lib.edges.filter((e) => ids.has(e.a) && ids.has(e.b)).length;
  const mostConnected = [...ideas]
    .map((i) => ({ i, d: lib.degree.get(i.id) ?? 0 }))
    .filter((x) => x.d > 0)
    .sort((a, b) => b.d - a.d)
    .slice(0, 4);

  const relatedTopics = useMemo(() => {
    const score = new Map<string, number>();
    for (const i of ideas) {
      for (const t of lib.topicsByIdea.get(i.id) ?? []) if (t.id !== id) score.set(t.id, (score.get(t.id) ?? 0) + 2);
      for (const c of lib.connections.get(i.id) ?? [])
        for (const t of lib.topicsByIdea.get(c.otherId) ?? []) if (t.id !== id) score.set(t.id, (score.get(t.id) ?? 0) + 1);
    }
    return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tid]) => lib.topicById.get(tid)!).filter(Boolean);
  }, [ideas, lib.topicsByIdea, lib.connections, lib.topicById, id]);

  const sources = useMemo(() => {
    const count = new Map<string, number>();
    for (const i of ideas) if (i.source_id) count.set(i.source_id, (count.get(i.source_id) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([sid, n]) => ({ s: lib.sourceById.get(sid)!, n })).filter((x) => x.s);
  }, [ideas, lib.sourceById]);

  const candidates = useMemo(() => {
    if (!adding.trim()) return [];
    return searchIdeas(lib.records.filter((r) => !r.idea.archived && !ids.has(r.idea.id)), adding).slice(0, 6);
  }, [adding, lib.records, ids]);

  if (!topic) {
    return (
      <Page>
        <h1 className="font-serif text-title">This topic isn&apos;t in your garden</h1>
        <Link href="/topics" className="btn-quiet mt-5">All topics</Link>
      </Page>
    );
  }

  const summarize = async () => {
    setSummary({ state: "loading", text: "" });
    try {
      const r = await callAI({ action: "summarize", topicId: id }, lib.data);
      setSummary({ state: "done", text: r.summary });
    } catch (e) {
      setSummary({ state: "error", text: e instanceof Error ? e.message : "The summary didn't come back." });
    }
  };

  return (
    <Page>
      <Link href="/topics" className="btn-ghost -ml-3 mb-8 h-8 px-2.5">
        <ArrowLeft size={15} strokeWidth={1.75} /> Topics
      </Link>

      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            lib.updateTopic(id, { name: name.trim(), description: desc.trim() || null });
            setEditing(false);
          }}
        >
          <input autoFocus className="field font-serif text-title" value={name} onChange={(e) => setName(e.target.value)} aria-label="Topic name" />
          <input className="field" value={desc} placeholder="What belongs here?" onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
          <div className="flex justify-between">
            <button
              type="button"
              className="btn-danger h-8 px-2.5"
              onClick={() => {
                if (!window.confirm(`Delete the topic “${topic.name}”? Its ideas stay in your garden.`)) return;
                lib.deleteTopic(id);
                toast.show("Topic deleted.");
                router.push("/topics");
              }}
            >
              Delete topic
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost h-8" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary h-8">Save</button>
            </div>
          </div>
        </form>
      ) : (
        <header>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ background: topicHue(lib.topicOrder.get(id) ?? 0, dark) }} />
            <h1 className="font-serif text-display font-medium tracking-[-0.01em]">{topic.name}</h1>
          </div>
          {topic.description && <p className="mt-1.5 text-read text-stem">{topic.description}</p>}
          <p className="mt-3 text-sm text-stem">
            {plural(ideas.length, "idea")}, {plural(inside, "connection")} between them, {plural(sources.length, "source")}.{" "}
            <button
              className="text-stem underline decoration-line underline-offset-4 hover:text-ink"
              onClick={() => {
                setName(topic.name);
                setDesc(topic.description ?? "");
                setEditing(true);
              }}
            >
              Edit topic
            </button>
          </p>
        </header>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn-quiet" onClick={() => ui.openCapture({ topicIds: [id] })}>
          <Plus size={15} /> New idea in {topic.name}
        </button>
        {ui.ai.enabled && ideas.length >= 2 && (
          <button className="btn-ghost" onClick={summarize} disabled={summary.state === "loading"}>
            <Sparkles size={14} strokeWidth={1.75} /> {summary.state === "loading" ? "Reading your ideas…" : "Summarize my thinking"}
          </button>
        )}
      </div>

      {summary.state === "done" && (
        <div className="mt-6 rounded-lg border border-line bg-sheet p-5">
          <p className="mb-2 text-sm font-medium text-stem">Your thinking on {topic.name}, so far</p>
          <AIAnswer text={summary.text} />
        </div>
      )}
      {summary.state === "error" && <p className="mt-4 text-sm text-rust">{summary.text}</p>}

      {ideas.length > 2 && inside > 0 && (
        <div className="mt-10 overflow-hidden rounded-lg border border-line bg-sheet/60">
          <GraphView nodeIds={ideas.map((i) => i.id)} className="h-72" compact showOrphans={false} onSelect={(nid) => nid && router.push(`/ideas/${nid}`)} />
        </div>
      )}

      {mostConnected.length > 1 && (
        <Section title="Most connected" className="mt-12">
          <ul className="space-y-2">
            {mostConnected.map(({ i, d }) => (
              <li key={i.id} className="flex items-baseline justify-between gap-4">
                <Link href={`/ideas/${i.id}`} className="font-serif text-[1.0625rem] text-ink hover:text-juniper">
                  {displayTitle(i)}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-faint">{plural(d, "connection")}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recent ideas" className="mt-12">
        {ideas.length ? (
          <div className="divide-y divide-line/70">
            {ideas.map((i) => (
              <IdeaRow key={i.id} idea={i} />
            ))}
          </div>
        ) : (
          <Empty title={`Nothing in ${topic.name} yet`}>Capture a new idea here, or add existing ones below.</Empty>
        )}
        <div className="relative mt-5">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={`Add an existing idea to ${topic.name}`} className="field h-9 text-sm" aria-label="Add existing idea" />
          {candidates.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
              {candidates.map(({ idea }) => (
                <button
                  key={idea.id}
                  className="block w-full truncate px-3 py-1.5 text-left font-serif hover:bg-moss"
                  onClick={() => {
                    lib.toggleIdeaTopic(idea.id, id);
                    setAdding("");
                  }}
                >
                  {displayTitle(idea)}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {(relatedTopics.length > 0 || sources.length > 0) && (
        <div className="mt-12 grid gap-10 sm:grid-cols-2">
          {relatedTopics.length > 0 && (
            <section>
              <h2 className="mb-2 font-serif text-[1.0625rem] font-medium">Related topics</h2>
              <ul className="space-y-1">
                {relatedTopics.map((t) => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: topicHue(lib.topicOrder.get(t.id) ?? 0, dark) }} />
                    <Link href={`/topics/${t.id}`} className="text-ink hover:text-juniper">{t.name}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {sources.length > 0 && (
            <section>
              <h2 className="mb-2 font-serif text-[1.0625rem] font-medium">Sources</h2>
              <ul className="space-y-1">
                {sources.slice(0, 6).map(({ s, n }) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/sources/${s.id}`} className="truncate font-serif italic text-ink hover:text-juniper">{s.title}</Link>
                    <span className="shrink-0 text-xs tabular-nums text-faint">{n}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
