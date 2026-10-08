"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { Empty, PageHeader } from "@/components/idea-bits";
import { cx, formatDate, plural } from "@/lib/text";
import { SOURCE_TYPES, sourceTypeLabel, type SourceType } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

export default function SourcesPage() {
  useTitle("Sources");
  const lib = useLibrary();
  const router = useRouter();
  const [type, setType] = useState<SourceType | "">("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [newType, setNewType] = useState<SourceType>("book");

  const sources = useMemo(() => {
    const lastCaptured = (id: string) => {
      const ids = lib.ideasBySource.get(id) ?? [];
      return ids.length ? lib.ideaById.get(ids[0])!.created_at : "";
    };
    return [...lib.data.sources]
      .filter((s) => !type || s.source_type === type)
      .sort((a, b) => (lastCaptured(b.id) || b.created_at).localeCompare(lastCaptured(a.id) || a.created_at));
  }, [lib.data.sources, lib.ideasBySource, lib.ideaById, type]);

  const typesInUse = SOURCE_TYPES.filter((t) => lib.data.sources.some((s) => s.source_type === t.value));

  return (
    <Page>
      <PageHeader title="Sources" description="Where your ideas came from, and what you took away from each.">
        <button className="btn-quiet" onClick={() => setAdding((a) => !a)}>
          <Plus size={15} /> Add source
        </button>
      </PageHeader>

      {adding && (
        <form
          className="mb-8 animate-fade space-y-3 rounded-md border border-line bg-sheet p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const id = lib.createSource({ title, author, source_type: newType });
            router.push(`/sources/${id}`);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input autoFocus className="field" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            <input className="field" placeholder="Author (optional)" value={author} onChange={(e) => setAuthor(e.target.value)} aria-label="Author" />
            <select className="field" value={newType} onChange={(e) => setNewType(e.target.value as SourceType)} aria-label="Kind of source">
              {SOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost h-8" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary h-8" disabled={!title.trim()}>
              Add source
            </button>
          </div>
        </form>
      )}

      {typesInUse.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {[{ value: "" as const, plural: "All" }, ...typesInUse].map((t) => (
            <button
              key={t.value || "all"}
              onClick={() => setType(t.value)}
              className={cx(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                type === t.value ? "border-juniper/40 bg-moss text-ink" : "border-line text-stem hover:text-ink"
              )}
            >
              {t.plural}
            </button>
          ))}
        </div>
      )}

      {sources.length ? (
        <ul className="divide-y divide-line">
          {sources.map((s) => {
            const n = lib.ideasBySource.get(s.id)?.length ?? 0;
            const latest = (lib.ideasBySource.get(s.id) ?? [])[0];
            return (
              <li key={s.id}>
                <Link href={`/sources/${s.id}`} className="-mx-3 grid grid-cols-[1fr_auto] items-baseline gap-x-6 rounded-md px-3 py-4 transition-colors hover:bg-sheet">
                  <div className="min-w-0">
                    <p className="font-serif text-read italic text-ink">{s.title}</p>
                    <p className="text-sm text-stem">
                      {s.author ? `${s.author}, ` : ""}
                      {sourceTypeLabel(s.source_type).toLowerCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums text-ink">{plural(n, "idea")}</p>
                    {latest && <p className="text-xs text-faint">last {formatDate(lib.ideaById.get(latest)!.created_at)}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="No sources yet">When you capture an idea from a book, paper, talk or conversation, its source appears here.</Empty>
      )}
    </Page>
  );
}
