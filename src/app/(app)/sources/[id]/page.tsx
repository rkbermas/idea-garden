"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { Empty, GrowthMark, TagList } from "@/components/idea-bits";
import { displayTitle, formatDate, plural, previewText } from "@/lib/text";
import { SOURCE_TYPES, sourceTypeLabel, type SourceType } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

export default function SourcePage() {
  const { id } = useParams<{ id: string }>();
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const router = useRouter();
  const source = lib.sourceById.get(id);
  useTitle(source?.title ?? "Source");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", source_type: "book" as SourceType, url: "", publication_date: "", notes: "" });

  useEffect(() => {
    if (source)
      setForm({
        title: source.title,
        author: source.author ?? "",
        source_type: source.source_type,
        url: source.url ?? "",
        publication_date: source.publication_date ?? "",
        notes: source.notes ?? "",
      });
  }, [source, editing]);

  if (!source) {
    return (
      <Page>
        <h1 className="font-serif text-title">This source isn&apos;t in your garden</h1>
        <Link href="/sources" className="btn-quiet mt-5">
          All sources
        </Link>
      </Page>
    );
  }

  const ideas = (lib.ideasBySource.get(id) ?? [])
    .map((x) => lib.ideaById.get(x)!)
    .filter((i) => i && !i.archived)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const tagCounts = new Map<string, number>();
  for (const i of ideas) for (const t of lib.tagsByIdea.get(i.id) ?? []) tagCounts.set(t.name, (tagCounts.get(t.name) ?? 0) + 1);
  const themes = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <Page>
      <Link href="/sources" className="btn-ghost -ml-3 mb-8 h-8 px-2.5">
        <ArrowLeft size={15} strokeWidth={1.75} /> Sources
      </Link>

      {editing ? (
        <form
          className="space-y-3 rounded-md border border-line bg-sheet p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return;
            lib.updateSource(id, {
              title: form.title.trim(),
              author: form.author.trim() || null,
              source_type: form.source_type,
              url: form.url.trim() || null,
              publication_date: form.publication_date.trim() || null,
              notes: form.notes.trim() || null,
            });
            setEditing(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-title">Title</label>
              <input id="s-title" className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="s-author">Author</label>
              <input id="s-author" className="field" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="s-type">Kind</label>
              <select id="s-type" className="field" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}>
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="s-date">Published</label>
              <input id="s-date" className="field" value={form.publication_date} placeholder="Optional" onChange={(e) => setForm({ ...form, publication_date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="s-url">Link</label>
            <input id="s-url" className="field" type="url" value={form.url} placeholder="https://" onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-notes">Notes</label>
            <textarea id="s-notes" className="field min-h-[5rem]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-between gap-2 pt-1">
            <button
              type="button"
              className="btn-danger h-8 px-2.5"
              onClick={() => {
                if (!window.confirm(`Delete this source? Its ${plural(ideas.length, "idea")} stay in your garden without a source.`)) return;
                lib.deleteSource(id);
                toast.show("Source deleted.");
                router.push("/sources");
              }}
            >
              Delete source
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost h-8" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary h-8">Save source</button>
            </div>
          </div>
        </form>
      ) : (
        <header>
          <p className="text-sm text-stem">{sourceTypeLabel(source.source_type)}</p>
          <h1 className="mt-1 font-serif text-display font-medium italic tracking-[-0.01em] text-ink text-balance">{source.title}</h1>
          {source.author && <p className="mt-1 text-read text-stem">{source.author}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stem">
            {source.publication_date && <span>{source.publication_date}</span>}
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="underline decoration-line underline-offset-4 hover:decoration-juniper">
                {source.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
              </a>
            )}
            <button className="text-stem hover:text-ink" onClick={() => setEditing(true)}>Edit details</button>
          </div>
          {source.notes && <p className="mt-4 max-w-prose text-stem">{source.notes}</p>}
        </header>
      )}

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-2">
          <h2 className="section-title">What I took away</h2>
          <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink" onClick={() => ui.openCapture({ sourceId: id })}>
            <Plus size={14} /> Capture from this source
          </button>
        </div>
        {themes.length > 1 && (
          <p className="mb-5 text-sm text-stem">
            Mostly about {themes.slice(0, 3).map(([t]) => t).join(", ")}.
          </p>
        )}
        {ideas.length ? (
          <ol className="space-y-6">
            {ideas.map((i, n) => (
              <li key={i.id} className="grid grid-cols-[1.75rem_1fr] gap-x-2">
                <span className="pt-0.5 text-right font-serif text-read tabular-nums text-faint">{n + 1}.</span>
                <div className="min-w-0">
                  <Link href={`/ideas/${i.id}`} className="font-serif text-read font-medium text-ink hover:text-juniper">
                    {displayTitle(i)}
                  </Link>
                  {previewText(i) && <p className="mt-0.5 line-clamp-2 font-serif text-[1.0625rem] leading-7 text-stem">{previewText(i)}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-faint">
                    <GrowthMark degree={lib.degree.get(i.id) ?? 0} />
                    {i.source_location && <span>{i.source_location}</span>}
                    <span>{formatDate(i.created_at)}</span>
                    <TagList ideaId={i.id} max={3} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No ideas from this source yet" action={<button className="btn-quiet" onClick={() => ui.openCapture({ sourceId: id })}>Capture the first one</button>} />
        )}
      </section>
    </Page>
  );
}
