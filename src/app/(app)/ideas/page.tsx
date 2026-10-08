"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Search, Sparkles, Star, X } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { Empty, IdeaRow, PageHeader } from "@/components/idea-bits";
import { FilterMenu } from "@/components/filter-menu";
import { callAI } from "@/lib/ai-client";
import { isEmptyQuery, parseQuery, searchIdeas, snippetAround } from "@/lib/search";
import { cx, daysSince, plural, shuffle, stripMarkdown } from "@/lib/text";
import { SOURCE_TYPES, type Idea, type SourceType } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

type Sort = "captured" | "edited" | "connected" | "oldest" | "random";
type DateRange = "week" | "month" | "year" | "older";
type Links = "with" | "without";
type Status = "active" | "inbox" | "archived";

const SORTS: { value: Sort; label: string }[] = [
  { value: "captured", label: "Recently captured" },
  { value: "edited", label: "Recently edited" },
  { value: "connected", label: "Most connected" },
  { value: "oldest", label: "Oldest" },
  { value: "random", label: "Random" },
];

function IdeasLibrary() {
  useTitle("All Ideas");
  const lib = useLibrary();
  const ui = useUI();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState(params.get("q") ?? "");
  const tag = params.get("tag") ?? "";
  const topic = params.get("topic") ?? "";
  const project = params.get("project") ?? "";
  const type = (params.get("type") ?? "") as SourceType | "";
  const date = (params.get("date") ?? "") as DateRange | "";
  const links = (params.get("links") ?? "") as Links | "";
  const status = (params.get("status") ?? "") as Status | "";
  const fav = params.get("fav") === "1";
  const sort = (params.get("sort") ?? "captured") as Sort;
  const [seed, setSeed] = useState(0);
  const [ai, setAi] = useState<{ q: string; state: "idle" | "loading" | "done" | "error"; items: { id: string; reason: string }[]; error?: string }>({ q: "", state: "idle", items: [] });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  // Keep the query in the URL (debounced) so searches can be linked and revisited.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((params.get("q") ?? "") !== q) setParam("q", q.trim());
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const fromUrl = params.get("q") ?? "";
    if (fromUrl !== q.trim()) setQ(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const tagObj = lib.data.tags.find((t) => t.name === tag);

  const filtered = useMemo(() => {
    const pool = status === "archived" ? lib.archived : lib.ideas;
    const ok = (i: Idea) => {
      if (status === "inbox" && i.status !== "inbox") return false;
      if (status === "active" && i.status !== "active") return false;
      if (tag && !(lib.tagsByIdea.get(i.id) ?? []).some((t) => t.name === tag)) return false;
      if (topic === "none" && (lib.topicsByIdea.get(i.id) ?? []).length) return false;
      if (topic && topic !== "none" && !(lib.topicsByIdea.get(i.id) ?? []).some((t) => t.id === topic)) return false;
      if (project && !(lib.projectsByIdea.get(i.id) ?? []).some((p) => p.id === project)) return false;
      if (type) {
        const s = i.source_id ? lib.sourceById.get(i.source_id) : undefined;
        if (s?.source_type !== type) return false;
      }
      if (date) {
        const d = daysSince(i.created_at);
        if (date === "week" && d > 7) return false;
        if (date === "month" && d > 31) return false;
        if (date === "year" && d > 365) return false;
        if (date === "older" && d <= 365) return false;
      }
      const deg = lib.degree.get(i.id) ?? 0;
      if (links === "with" && deg === 0) return false;
      if (links === "without" && deg > 0) return false;
      if (fav && !i.favorite) return false;
      return true;
    };
    return pool.filter(ok);
  }, [lib, status, tag, topic, project, type, date, links, fav]);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const searching = !isEmptyQuery(parsed);

  const results = useMemo(() => {
    const ids = new Set(filtered.map((i) => i.id));
    const records = lib.records.filter((r) => ids.has(r.idea.id));
    if (searching) return searchIdeas(records, q).map((r) => r.idea);
    const list = [...filtered];
    switch (sort) {
      case "edited":
        return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      case "connected":
        return list.sort((a, b) => (lib.degree.get(b.id) ?? 0) - (lib.degree.get(a.id) ?? 0) || b.created_at.localeCompare(a.created_at));
      case "oldest":
        return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
      case "random":
        return shuffle(list);
      default:
        return list;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, lib.records, lib.degree, searching, q, sort, seed]);

  // Ideas that share vocabulary with the query but don't contain it.
  const nearby = useMemo(() => {
    if (!searching || !parsed.terms.length) return [];
    const shown = new Set(results.map((i) => i.id));
    const allowed = new Set(filtered.map((i) => i.id));
    return lib.similarity
      .query(parsed.terms.join(" "), 12)
      .filter((r) => !shown.has(r.id) && allowed.has(r.id))
      .slice(0, 5)
      .map((r) => lib.ideaById.get(r.id)!)
      .filter(Boolean);
  }, [searching, parsed.terms, results, filtered, lib.similarity, lib.ideaById]);

  const aiExtra = ai.q === q.trim() && ai.state === "done" ? ai.items.filter((x) => !results.some((r) => r.id === x.id) && lib.ideaById.has(x.id)) : [];

  const searchByMeaning = async () => {
    const query = q.trim();
    setAi({ q: query, state: "loading", items: [] });
    try {
      const r = await callAI({ action: "search", query }, lib.data);
      setAi({ q: query, state: "done", items: r.results });
    } catch (e) {
      setAi({ q: query, state: "error", items: [], error: e instanceof Error ? e.message : "Search by meaning failed." });
    }
  };

  const activeFilters = [tag, topic, project, type, date, links, status, fav ? "1" : ""].filter(Boolean).length;

  const count = (pred: (i: Idea) => boolean) => lib.ideas.filter(pred).length;

  return (
    <Page width="wide">
      <div className="mx-auto max-w-read">
        <PageHeader title="All Ideas" description={`${plural(lib.ideas.length, "idea")} in your garden.`} />

        <div className="relative">
          <Search size={17} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQ("")}
            placeholder="Search ideas, thoughts, sources, authors, tags"
            className="field h-11 pl-10 pr-10 text-[0.9375rem]"
            aria-label="Search ideas"
          />
          {q && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-faint hover:text-ink" onClick={() => setQ("")} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <FilterMenu
            label="Tag"
            value={tag}
            searchable
            onChange={(v) => setParam("tag", v)}
            options={[...lib.data.tags]
              .map((t) => ({ value: t.name, label: t.name, count: lib.ideasByTag.get(t.id)?.length ?? 0 }))
              .filter((o) => o.count > 0 || o.value === tag)
              .sort((a, b) => b.count - a.count)}
          />
          <FilterMenu
            label="Topic"
            value={topic}
            onChange={(v) => setParam("topic", v)}
            options={[
              ...lib.data.topics.map((t) => ({ value: t.id, label: t.name, count: lib.ideasByTopic.get(t.id)?.length ?? 0 })),
              { value: "none", label: "No topic yet", count: count((i) => !(lib.topicsByIdea.get(i.id) ?? []).length) },
            ]}
          />
          <FilterMenu
            label="Source type"
            value={type}
            onChange={(v) => setParam("type", v)}
            options={SOURCE_TYPES.map((s) => ({
              value: s.value,
              label: s.plural,
              count: count((i) => !!i.source_id && lib.sourceById.get(i.source_id)?.source_type === s.value),
            })).filter((o) => o.count > 0 || o.value === type)}
          />
          <FilterMenu
            label="Date"
            value={date}
            onChange={(v) => setParam("date", v)}
            options={[
              { value: "week", label: "Past week" },
              { value: "month", label: "Past month" },
              { value: "year", label: "Past year" },
              { value: "older", label: "Over a year ago" },
            ]}
          />
          {lib.data.projects.length > 0 && (
            <FilterMenu
              label="Project"
              value={project}
              onChange={(v) => setParam("project", v)}
              options={lib.data.projects.map((p) => ({ value: p.id, label: p.name, count: lib.ideasByProject.get(p.id)?.length ?? 0 }))}
            />
          )}
          <FilterMenu
            label="Connections"
            value={links}
            onChange={(v) => setParam("links", v)}
            options={[
              { value: "with", label: "Has connections", count: count((i) => (lib.degree.get(i.id) ?? 0) > 0) },
              { value: "without", label: "No connections", count: count((i) => !(lib.degree.get(i.id) ?? 0)) },
            ]}
          />
          <FilterMenu
            label="Status"
            value={status}
            onChange={(v) => setParam("status", v)}
            options={[
              { value: "active", label: "Kept ideas", count: count((i) => i.status === "active") },
              { value: "inbox", label: "In Inbox", count: lib.inbox.length },
              { value: "archived", label: "Archived", count: lib.archived.length },
            ]}
          />
          <button
            onClick={() => setParam("fav", fav ? "" : "1")}
            aria-pressed={fav}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              fav ? "border-juniper/40 bg-moss text-ink" : "border-line text-stem hover:border-faint/60 hover:text-ink"
            )}
          >
            <Star size={13} strokeWidth={1.75} className={fav ? "fill-juniper text-juniper" : ""} /> Favorites
          </button>
          {activeFilters > 0 && (
            <button className="ml-1 text-sm text-stem underline decoration-line underline-offset-4 hover:text-ink" onClick={() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname)}>
              Clear filters
            </button>
          )}
        </div>

        <div className="mb-2 mt-8 flex items-center justify-between gap-3 border-b border-line pb-2.5">
          <p className="text-sm text-stem">
            {searching ? `${plural(results.length, "match", "matches")}` : plural(results.length, "idea")}
            {tagObj && <> tagged {tagObj.name}</>}
          </p>
          {!searching ? (
            <div className="flex items-center gap-2">
              {sort === "random" && (
                <button className="text-sm text-stem hover:text-ink" onClick={() => setSeed((s) => s + 1)}>
                  Shuffle again
                </button>
              )}
              <FilterMenu label="Sort" value={sort} align="right" onChange={(v) => setParam("sort", v === "captured" ? "" : v)} options={SORTS} />
            </div>
          ) : (
            ui.ai.enabled &&
            parsed.terms.length > 0 && (
              <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink disabled:opacity-50" onClick={searchByMeaning} disabled={ai.state === "loading" && ai.q === q.trim()}>
                <Sparkles size={14} strokeWidth={1.75} />
                {ai.state === "loading" && ai.q === q.trim() ? "Searching by meaning…" : "Search by meaning"}
              </button>
            )
          )}
        </div>

        {results.length ? (
          <div className="divide-y divide-line/70">
            {results.map((i) => (
              <IdeaRow
                key={i.id}
                idea={i}
                terms={parsed.terms}
                snippet={searching && parsed.terms.length ? snippetAround(stripMarkdown(i.content), parsed.terms, 200) : undefined}
              />
            ))}
          </div>
        ) : searching ? (
          <div className="py-10 text-center">
            <p className="font-serif text-read">Nothing contains “{q}”.</p>
            <p className="mt-1 text-sm text-stem">Try fewer words, or capture it as a new idea.</p>
            <button className="btn-quiet mt-4" onClick={() => ui.openCapture({ content: q })}>
              Capture “{q.length > 40 ? q.slice(0, 40) + "…" : q}”
            </button>
          </div>
        ) : lib.ideas.length ? (
          <Empty title="No ideas match these filters">Remove a filter to see more of your garden.</Empty>
        ) : (
          <Empty title="Your garden is empty" action={<button className="btn-primary" onClick={() => ui.openCapture()}>Capture an idea</button>}>
            Every idea you save will be here, searchable by its words, source, tags and your own thoughts.
          </Empty>
        )}

        {ai.q === q.trim() && ai.state === "error" && <p className="mt-6 text-sm text-rust">{ai.error}</p>}
        {aiExtra.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 font-serif text-[1.0625rem] text-ink">Related by meaning</h2>
            <p className="mb-2 text-sm text-stem">These don&apos;t use your words, but seem to be about the same thing.</p>
            <div className="divide-y divide-line/70">
              {aiExtra.map((x) => (
                <IdeaRow key={x.id} idea={lib.ideaById.get(x.id)!} snippet={x.reason} />
              ))}
            </div>
          </section>
        )}
        {nearby.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-1 font-serif text-[1.0625rem] text-ink">Nearby ideas</h2>
            <p className="mb-2 text-sm text-stem">Close in vocabulary, tags or topic.</p>
            <div className="divide-y divide-line/70">
              {nearby.map((i) => (
                <IdeaRow key={i.id} idea={i} dense />
              ))}
            </div>
          </section>
        )}
      </div>
    </Page>
  );
}

export default function IdeasPage() {
  return (
    <Suspense>
      <IdeasLibrary />
    </Suspense>
  );
}
