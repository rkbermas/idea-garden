"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shuffle, Sparkles } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { AIAnswer } from "@/components/ai-answer";
import { GrowthMark, PageHeader, Section, SourceLine } from "@/components/idea-bits";
import { Markdown } from "@/components/markdown";
import { callAI } from "@/lib/ai-client";
import { forgottenIdeas, lastSeen } from "@/lib/resurface";
import { daysSince, displayTitle, plural, relativeDays } from "@/lib/text";
import { useTitle } from "@/lib/use-title";

function TitleLink({ id }: { id: string }) {
  const lib = useLibrary();
  const i = lib.ideaById.get(id);
  if (!i) return null;
  return (
    <Link href={`/ideas/${id}`} className="font-serif text-[1.0625rem] leading-7 text-ink hover:text-juniper">
      {displayTitle(i)}
    </Link>
  );
}

function AskLibrary() {
  const lib = useLibrary();
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; answer: string; asked: string }>({ status: "idle", answer: "", asked: "" });

  const ask = async (question: string) => {
    if (!question.trim()) return;
    setState({ status: "loading", answer: "", asked: question });
    try {
      const r = await callAI({ action: "ask", question }, lib.data);
      setState({ status: "done", answer: r.answer, asked: question });
    } catch (e) {
      setState({ status: "error", answer: e instanceof Error ? e.message : "No answer came back.", asked: question });
    }
  };

  return (
    <section className="mb-14 rounded-lg border border-line bg-sheet p-5 sm:p-6">
      <h2 className="font-serif text-lead font-medium">Ask my library</h2>
      <p className="mt-0.5 text-sm text-stem">Answers come only from ideas you&apos;ve saved, with links to each one.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What have I saved about motivation?" className="field" aria-label="Question for your library" />
        <button className="btn-primary" disabled={!q.trim() || state.status === "loading"}>
          Ask
        </button>
      </form>
      {state.status === "idle" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["What have I saved about measurement?", "Where do my ideas about learning disagree?", "What connects design and psychology in my notes?"].map((s) => (
            <button key={s} className="chip" onClick={() => { setQ(s); void ask(s); }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {state.status === "loading" && <p className="mt-4 text-sm text-stem">Reading your library…</p>}
      {state.status === "error" && <p className="mt-4 text-sm text-rust">{state.answer}</p>}
      {state.status === "done" && (
        <div className="mt-5 animate-fade">
          <AIAnswer text={state.answer} />
        </div>
      )}
    </section>
  );
}

export default function ExplorePage() {
  useTitle("Explore");
  const lib = useLibrary();
  const ui = useUI();
  const active = useMemo(() => lib.ideas.filter((i) => i.status === "active"), [lib.ideas]);
  const [n, setN] = useState(() => Math.floor(Math.random() * 1000));
  const random = active.length ? active[n % active.length] : undefined;

  const forgotten = useMemo(() => forgottenIdeas(active, 21).slice(0, 5), [active]);
  const connected = useMemo(
    () => [...lib.ideas].filter((i) => (lib.degree.get(i.id) ?? 0) >= 2).sort((a, b) => (lib.degree.get(b.id) ?? 0) - (lib.degree.get(a.id) ?? 0)).slice(0, 5),
    [lib.ideas, lib.degree]
  );

  const emerging = useMemo(() => {
    return lib.data.topics
      .map((t) => {
        const ids = (lib.ideasByTopic.get(t.id) ?? []).map((x) => lib.ideaById.get(x)!).filter((i) => i && !i.archived);
        const recent = ids.filter((i) => daysSince(i.created_at) <= 30).length;
        const before = ids.filter((i) => daysSince(i.created_at) > 30 && daysSince(i.created_at) <= 120).length;
        return { t, total: ids.length, recent, growth: recent / Math.max(before / 3, 1) };
      })
      .filter((x) => x.recent > 0)
      .sort((a, b) => b.growth - a.growth || b.recent - a.recent)
      .slice(0, 4);
  }, [lib.data.topics, lib.ideasByTopic, lib.ideaById]);

  const clusters = useMemo(
    () =>
      lib.clusters.slice(0, 4).map((members) => {
        const counts = new Map<string, number>();
        for (const id of members) for (const t of lib.topicsByIdea.get(id) ?? []) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
        if (!counts.size) for (const id of members) for (const t of lib.tagsByIdea.get(id) ?? []) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
        const label = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
        const ordered = [...members].sort((a, b) => (lib.degree.get(b) ?? 0) - (lib.degree.get(a) ?? 0));
        return { members: ordered, label };
      }),
    [lib.clusters, lib.topicsByIdea, lib.tagsByIdea, lib.degree]
  );

  const contradictions = lib.data.links.filter(
    (l) => l.relationship_type === "contradicts" && lib.ideaById.has(l.source_idea_id) && lib.ideaById.has(l.target_idea_id)
  );

  const [aiPairs, setAiPairs] = useState<{ state: "idle" | "loading" | "done" | "error"; pairs: { a: string; b: string; reason: string }[]; error?: string }>({ state: "idle", pairs: [] });
  const findContradictions = async () => {
    setAiPairs({ state: "loading", pairs: [] });
    try {
      const r = await callAI({ action: "contradictions" }, lib.data);
      const known = new Set(contradictions.map((l) => [l.source_idea_id, l.target_idea_id].sort().join("|")));
      setAiPairs({
        state: "done",
        pairs: r.pairs.filter((p) => lib.ideaById.has(p.a) && lib.ideaById.has(p.b) && p.a !== p.b && !known.has([p.a, p.b].sort().join("|"))),
      });
    } catch (e) {
      setAiPairs({ state: "error", pairs: [], error: e instanceof Error ? e.message : "Nothing came back." });
    }
  };

  const randomSource = random?.source_id ? lib.sourceById.get(random.source_id) : undefined;

  return (
    <Page>
      <PageHeader title="Explore" description="Wander back through what you've saved. Old ideas look different next to new ones." />

      {ui.ai.enabled && <AskLibrary />}

      {random && (
        <Section
          title="Random idea"
          action={
            <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink" onClick={() => setN((x) => x + 1 + Math.floor(Math.random() * 7))}>
              <Shuffle size={14} strokeWidth={1.75} /> Another
            </button>
          }
        >
          <article key={random.id} className="animate-fade border-l-2 border-juniper/50 pl-5">
            <Link href={`/ideas/${random.id}`} className="font-serif text-title font-medium text-ink text-pretty hover:text-juniper">
              {displayTitle(random)}
            </Link>
            {random.title && <Markdown text={random.content} className="mt-2 !text-[1.0625rem] !leading-7 text-stem" />}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
              <SourceLine source={randomSource} />
              <span>Saved {relativeDays(random.created_at)}</span>
            </div>
          </article>
        </Section>
      )}

      <Section title="Forgotten ideas">
        {forgotten.length ? (
          <ul className="space-y-3">
            {forgotten.map((i) => (
              <li key={i.id} className="flex items-baseline justify-between gap-4">
                <TitleLink id={i.id} />
                <span className="shrink-0 text-xs text-faint">not opened in {relativeDays(lastSeen(i)).replace(" ago", "")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">You&apos;ve looked at everything in the last three weeks. Check back later.</p>
        )}
      </Section>

      <Section title="Highly connected">
        {connected.length ? (
          <ul className="space-y-3">
            {connected.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3">
                <GrowthMark degree={lib.degree.get(i.id) ?? 0} className="translate-y-[2px]" />
                <span className="flex-1">
                  <TitleLink id={i.id} />
                </span>
                <span className="shrink-0 text-xs tabular-nums text-faint">{plural(lib.degree.get(i.id) ?? 0, "connection")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">Ideas with two or more connections collect here. Link a few with [[ to start.</p>
        )}
      </Section>

      {emerging.length > 0 && (
        <Section title="Emerging topics">
          <ul className="space-y-3">
            {emerging.map(({ t, total, recent }) => (
              <li key={t.id} className="flex items-baseline justify-between gap-4">
                <Link href={`/topics/${t.id}`} className="font-serif text-[1.0625rem] text-ink hover:text-juniper">
                  {t.name}
                </Link>
                <span className="text-sm text-stem">
                  {recent} new this month, {total} in all
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {clusters.length > 0 && (
        <Section title="Interesting clusters">
          <p className="-mt-1 mb-4 text-sm text-stem">Groups of ideas more tightly linked to each other than to the rest of your garden.</p>
          <div className="space-y-6">
            {clusters.map((c, i) => (
              <div key={i}>
                <p className="mb-1 text-sm text-stem">
                  {c.label.length ? c.label.join(" and ") : "Untitled cluster"}, {plural(c.members.length, "idea")}
                </p>
                <p className="font-serif text-[1.0625rem] leading-8">
                  {c.members.slice(0, 8).map((id, k) => (
                    <span key={id}>
                      {k > 0 && <span className="text-faint">; </span>}
                      <Link href={`/ideas/${id}`} className="text-ink hover:text-juniper">
                        {displayTitle(lib.ideaById.get(id)!)}
                      </Link>
                    </span>
                  ))}
                  {c.members.length > 8 && <span className="text-faint"> and {c.members.length - 8} more</span>}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Contradictions"
        action={
          ui.ai.enabled && (
            <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink disabled:opacity-50" onClick={findContradictions} disabled={aiPairs.state === "loading"}>
              <Sparkles size={14} strokeWidth={1.75} /> {aiPairs.state === "loading" ? "Looking…" : "Find possible ones"}
            </button>
          )
        }
      >
        {contradictions.length ? (
          <ul className="space-y-5">
            {contradictions.map((l) => (
              <li key={l.id} className="grid gap-1 border-l-2 border-rust/40 pl-4">
                <TitleLink id={l.source_idea_id} />
                <span className="text-sm text-rust">contradicts</span>
                <TitleLink id={l.target_idea_id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">When you connect two ideas as contradicting, they show up here, side by side.</p>
        )}
        {aiPairs.state === "error" && <p className="mt-4 text-sm text-rust">{aiPairs.error}</p>}
        {aiPairs.state === "done" && (
          <div className="mt-8">
            <p className="mb-3 text-sm text-stem">{aiPairs.pairs.length ? "These may disagree. Mark the ones that really do:" : "No other disagreements stood out."}</p>
            <ul className="space-y-5">
              {aiPairs.pairs.map((p) => (
                <li key={`${p.a}-${p.b}`} className="grid gap-1 border-l-2 border-dashed border-line pl-4">
                  <TitleLink id={p.a} />
                  <TitleLink id={p.b} />
                  <p className="text-sm text-stem">{p.reason}</p>
                  <div>
                    <button
                      className="btn-quiet mt-1 h-7 px-2.5 text-xs"
                      onClick={() => {
                        lib.connect(p.a, p.b, "contradicts");
                        setAiPairs((s) => ({ ...s, pairs: s.pairs.filter((x) => x !== p) }));
                      }}
                    >
                      Mark as contradicting
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </Page>
  );
}
