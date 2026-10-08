"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import { GraphView } from "@/components/graph-view";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { FilterMenu } from "@/components/filter-menu";
import { Markdown } from "@/components/markdown";
import { SourceLine, TagList } from "@/components/idea-bits";
import { searchIdeas } from "@/lib/search";
import { topicHue } from "@/lib/graph";
import { cx, displayTitle, plural } from "@/lib/text";
import { relationshipLabel } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

function Legend({ dark }: { dark: boolean }) {
  const lib = useLibrary();
  const topics = [...lib.data.topics].sort((a, b) => (lib.topicOrder.get(a.id) ?? 0) - (lib.topicOrder.get(b.id) ?? 0));
  return (
    <div className="space-y-2 text-xs text-stem">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {topics.slice(0, 8).map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: topicHue(lib.topicOrder.get(t.id) ?? 0, dark) }} />
            {t.name}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-faint">
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="1.2" /></svg>
          connection
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 2.5" /></svg>
          [[link]] in text
        </span>
        <span className="inline-flex items-center gap-1.5 text-rust">
          <svg width="18" height="4" aria-hidden="true"><line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" /></svg>
          contradicts
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-current" /> in Inbox
        </span>
      </div>
    </div>
  );
}

function Outline() {
  const lib = useLibrary();
  const topics = [...lib.data.topics].sort((a, b) => (lib.ideasByTopic.get(b.id)?.length ?? 0) - (lib.ideasByTopic.get(a.id)?.length ?? 0));
  const untopiced = lib.ideas.filter((i) => !(lib.topicsByIdea.get(i.id) ?? []).length && (lib.degree.get(i.id) ?? 0) > 0);

  const tree = (ids: string[]) => {
    const inSet = new Set(ids);
    const placed = new Set<string>();
    const roots = [...ids].sort((a, b) => (lib.degree.get(b) ?? 0) - (lib.degree.get(a) ?? 0));
    return roots
      .filter((id) => {
        if (placed.has(id)) return false;
        placed.add(id);
        return true;
      })
      .map((id) => {
        const kids = (lib.connections.get(id) ?? []).filter((c) => inSet.has(c.otherId) && !placed.has(c.otherId));
        kids.forEach((k) => placed.add(k.otherId));
        return { id, kids };
      });
  };

  const Group = ({ name, href, ids }: { name: string; href?: string; ids: string[] }) => (
    <section className="mb-10">
      <h2 className="mb-2 font-serif text-lead font-medium">{href ? <Link href={href} className="hover:text-juniper">{name}</Link> : name}</h2>
      <ul className="border-l border-line">
        {tree(ids).map(({ id, kids }) => (
          <li key={id} className="relative pl-5 pt-2 before:absolute before:left-0 before:top-[1.15rem] before:h-px before:w-3.5 before:bg-line">
            <Link href={`/ideas/${id}`} className="font-serif text-[1.0625rem] text-ink hover:text-juniper">
              {displayTitle(lib.ideaById.get(id)!)}
            </Link>
            {kids.length > 0 && (
              <ul className="ml-1 mt-1 border-l border-line">
                {kids.map((k) => (
                  <li key={k.otherId} className="relative py-1 pl-5 before:absolute before:left-0 before:top-[0.95rem] before:h-px before:w-3.5 before:bg-line">
                    <span className={cx("mr-1.5 text-xs", k.relationship === "contradicts" ? "text-rust" : "text-faint")}>
                      {k.kind === "wiki" ? "mentions" : relationshipLabel(k.relationship, k.outgoing)}
                    </span>
                    <Link href={`/ideas/${k.otherId}`} className="font-serif text-ink/90 hover:text-juniper">
                      {displayTitle(lib.ideaById.get(k.otherId)!)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto max-w-read px-5 pb-28 pt-8 sm:px-8">
      {topics.map((t) => {
        const ids = (lib.ideasByTopic.get(t.id) ?? []).filter((id) => !lib.ideaById.get(id)?.archived);
        return ids.length ? <Group key={t.id} name={t.name} href={`/topics/${t.id}`} ids={ids} /> : null;
      })}
      {untopiced.length > 0 && <Group name="Without a topic" ids={untopiced.map((i) => i.id)} />}
    </div>
  );
}

export default function ConnectionsPage() {
  useTitle("Connections");
  const lib = useLibrary();
  const ui = useUI();
  const router = useRouter();
  const [mode, setMode] = useState<"graph" | "outline">("graph");
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const [orphans, setOrphans] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const nodeIds = useMemo(() => {
    if (!topic) return undefined;
    const base = new Set(lib.ideasByTopic.get(topic) ?? []);
    // Include direct neighbours so a topic's links to the rest of the garden stay visible.
    for (const id of [...base]) for (const c of lib.connections.get(id) ?? []) base.add(c.otherId);
    return [...base];
  }, [topic, lib.ideasByTopic, lib.connections]);

  const highlight = useMemo(() => {
    if (!q.trim()) return null;
    return new Set(searchIdeas(lib.records, q).map((r) => r.idea.id));
  }, [q, lib.records]);

  const sel = selected ? lib.ideaById.get(selected) : undefined;
  const selConnections = selected ? lib.connections.get(selected) ?? [] : [];

  return (
    <div className={cx("relative", mode === "graph" ? "h-[calc(100dvh-3.25rem-env(safe-area-inset-top))] md:h-dvh" : "min-h-dvh")}>
      {mode === "graph" ? (
        <GraphView
          className="absolute inset-0"
          nodeIds={nodeIds}
          highlight={highlight}
          selectedId={selected}
          onSelect={setSelected}
          onOpen={(id) => router.push(`/ideas/${id}`)}
          showOrphans={orphans}
        />
      ) : (
        <div className="pt-36 sm:pt-32">
          <Outline />
        </div>
      )}

      {/* Controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-5">
        <div className="pointer-events-auto w-full max-w-md rounded-lg border border-line bg-paper/90 p-3.5 backdrop-blur sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-serif text-lead font-medium">Connections</h1>
            <div className="flex rounded-md border border-line p-0.5 text-xs" role="tablist">
              {(["graph", "outline"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cx("rounded px-2.5 py-1 capitalize", mode === m ? "bg-moss text-ink" : "text-stem hover:text-ink")}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-0.5 text-sm text-stem">
            {plural(lib.ideas.length, "idea")}, {plural(lib.edges.length, "connection")}
          </p>
          {mode === "graph" && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <div className="relative min-w-[10rem] flex-1">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find in graph" className="field h-8 py-1 pl-8 text-sm" aria-label="Find in graph" />
                </div>
                <FilterMenu label="Topic" value={topic} onChange={setTopic} options={lib.data.topics.map((t) => ({ value: t.id, label: t.name, count: lib.ideasByTopic.get(t.id)?.length ?? 0 }))} />
                <button
                  onClick={() => setOrphans((o) => !o)}
                  aria-pressed={!orphans}
                  className={cx("h-8 rounded-full border px-3 text-sm", !orphans ? "border-juniper/40 bg-moss text-ink" : "border-line text-stem hover:text-ink")}
                >
                  Connected only
                </button>
              </div>
              {highlight && <p className="mt-2 text-xs text-stem">{plural(highlight.size, "match", "matches")} highlighted</p>}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-faint hover:text-stem">Legend</summary>
                <div className="mt-2">
                  <Legend dark={dark} />
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {/* Selected idea panel */}
      {mode === "graph" && sel && (
        <aside className="absolute inset-x-3 bottom-3 max-h-[55%] animate-rise overflow-y-auto rounded-lg border border-line bg-sheet p-5 shadow-[0_24px_64px_-28px_rgb(0_0_0/0.45)] sm:inset-x-auto sm:bottom-5 sm:right-16 sm:top-5 sm:max-h-none sm:w-[22rem]">
          <button className="absolute right-3 top-3 rounded p-1 text-faint hover:bg-sunk hover:text-ink" onClick={() => setSelected(null)} aria-label="Close preview">
            <X size={15} />
          </button>
          <Link href={`/ideas/${sel.id}`} className="block pr-6 font-serif text-read font-medium leading-7 text-ink hover:text-juniper">
            {displayTitle(sel)}
          </Link>
          {sel.title && <Markdown text={sel.content} className="mt-2 !text-base !leading-7 text-stem" />}
          <SourceLine source={sel.source_id ? lib.sourceById.get(sel.source_id) : undefined} location={sel.source_location} className="mt-3 block" />
          <TagList ideaId={sel.id} className="mt-2" />
          {selConnections.length > 0 && (
            <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
              {selConnections.map((c) => (
                <li key={`${c.kind}-${c.linkId ?? c.otherId}`} className="text-sm">
                  <span className={c.relationship === "contradicts" ? "text-rust" : "text-faint"}>
                    {c.kind === "wiki" ? (c.outgoing ? "mentions" : "mentioned by") : relationshipLabel(c.relationship, c.outgoing)}
                  </span>{" "}
                  <button className="text-left font-serif text-ink hover:text-juniper" onClick={() => setSelected(c.otherId)}>
                    {displayTitle(lib.ideaById.get(c.otherId)!)}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex gap-2">
            <Link href={`/ideas/${sel.id}`} className="btn-primary h-8">
              Open idea
            </Link>
            <button className="btn-quiet h-8" onClick={() => ui.openConnect(sel.id)}>
              <Link2 size={14} /> Connect
            </button>
          </div>
        </aside>
      )}

      {lib.ideas.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div>
            <p className="font-serif text-read">Nothing to map yet</p>
            <p className="mt-1 text-sm text-stem">Capture a few ideas and link them with [[ to watch the garden take shape.</p>
          </div>
        </div>
      )}
    </div>
  );
}
