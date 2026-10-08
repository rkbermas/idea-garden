"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Check, Link2, Trash2 } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { Markdown } from "@/components/markdown";
import { Empty, PageHeader } from "@/components/idea-bits";
import { SourceFields, TagInput, emptySourceDraft, type SourceDraft } from "@/components/fields";
import { WikiEditor } from "@/components/wiki-editor";
import { cx, displayTitle, plural, relativeTime } from "@/lib/text";
import type { Idea } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

function InboxItem({ idea }: { idea: Idea }) {
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(idea.title ?? "");
  const [thoughts, setThoughts] = useState(idea.personal_thoughts ?? "");
  const [tags, setTags] = useState<string[]>((lib.tagsByIdea.get(idea.id) ?? []).map((t) => t.name));
  const [source, setSource] = useState<SourceDraft>(emptySourceDraft());
  const [topics, setTopics] = useState<string[]>((lib.topicsByIdea.get(idea.id) ?? []).map((t) => t.id));

  const keep = (withDetails: boolean) => {
    if (withDetails) {
      lib.updateIdea(idea.id, {
        title: title.trim() || null,
        personal_thoughts: thoughts.trim() || null,
        status: "active",
        source_location: source.location.trim() || idea.source_location,
      });
      lib.setIdeaTags(idea.id, tags);
      if (source.sourceId) lib.setIdeaSource(idea.id, { sourceId: source.sourceId });
      else if (source.title.trim()) lib.setIdeaSource(idea.id, { newSource: { title: source.title, author: source.author, source_type: source.type } });
      const current = (lib.topicsByIdea.get(idea.id) ?? []).map((t) => t.id);
      for (const t of new Set([...current, ...topics])) if (current.includes(t) !== topics.includes(t)) lib.toggleIdeaTopic(idea.id, t);
    } else {
      lib.updateIdea(idea.id, { status: "active" });
    }
    toast.show("Kept as an idea.", { action: { label: "Open", run: () => router.push(`/ideas/${idea.id}`) } });
  };

  const source0 = idea.source_id ? lib.sourceById.get(idea.source_id) : undefined;

  return (
    <li className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {idea.title && (
            <Link href={`/ideas/${idea.id}`} className="font-serif text-read font-medium text-ink hover:text-juniper">
              {idea.title}
            </Link>
          )}
          <Markdown text={idea.content} className={cx(idea.title ? "mt-1 text-stem" : "")} />
          <p className="mt-1.5 text-xs text-faint">
            Captured {relativeTime(idea.created_at)}
            {source0 && <> from <span className="font-serif italic">{source0.title}</span></>}
          </p>
        </div>
      </div>

      {open ? (
        <div className="mt-4 animate-fade space-y-4 rounded-md border border-line bg-sheet p-4">
          <div>
            <label className="label" htmlFor={`t-${idea.id}`}>
              Title
            </label>
            <input id={`t-${idea.id}`} className="field font-serif" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={displayTitle({ title: null, content: idea.content })} />
          </div>
          {!source0 && <SourceFields draft={source} onChange={setSource} />}
          <div>
            <span className="label">My thoughts</span>
            <WikiEditor
              value={thoughts}
              onChange={setThoughts}
              excludeId={idea.id}
              minRows={2}
              placeholder="Context, interpretation, where it might apply. Type [[ to link."
              className="field min-h-[4rem] font-serif text-[1.0625rem] leading-7"
              onSubmit={() => keep(true)}
            />
          </div>
          <div>
            <span className="label">Tags</span>
            <TagInput value={tags} onChange={setTags} />
          </div>
          {lib.data.topics.length > 0 && (
            <div>
              <span className="label">Topics</span>
              <div className="flex flex-wrap gap-1.5">
                {lib.data.topics.map((t) => {
                  const on = topics.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTopics((x) => (on ? x.filter((y) => y !== t.id) : [...x, t.id]))}
                      className={cx("rounded-full border px-2.5 py-1 text-xs", on ? "border-juniper/50 bg-moss text-ink" : "border-line text-stem hover:text-ink")}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button className="btn-ghost -ml-2 h-8 px-2" onClick={() => ui.openConnect(idea.id)}>
              <Link2 size={14} /> Connect to an idea
            </button>
            <div className="flex gap-2">
              <button className="btn-ghost h-8" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary h-8" onClick={() => keep(true)}>
                Keep with details
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button className="btn-quiet h-8" onClick={() => keep(false)}>
            <Check size={14} /> Keep as idea
          </button>
          <button className="btn-quiet h-8" onClick={() => setOpen(true)}>
            Add details
          </button>
          <button
            className="btn-ghost h-8"
            onClick={() => {
              lib.updateIdea(idea.id, { archived: true });
              toast.show("Archived.", { action: { label: "Undo", run: () => lib.updateIdea(idea.id, { archived: false }) } });
            }}
          >
            <Archive size={14} strokeWidth={1.75} /> Archive
          </button>
          <button
            className="btn-danger h-8"
            onClick={() => {
              if (window.confirm("Delete this idea for good?")) {
                lib.deleteIdea(idea.id);
                toast.show("Deleted.");
              }
            }}
          >
            <Trash2 size={14} strokeWidth={1.75} /> Delete
          </button>
        </div>
      )}
    </li>
  );
}

export default function InboxPage() {
  useTitle("Inbox");
  const lib = useLibrary();
  const ui = useUI();
  const items = [...lib.inbox].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <Page>
      <PageHeader
        title="Inbox"
        description={
          items.length
            ? `${plural(items.length, "quick capture")} waiting. Add a source, tags or a connection when you have a minute, oldest first.`
            : "Quick captures land here until you give them some context."
        }
      />
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <InboxItem key={i.id} idea={i} />
          ))}
        </ul>
      ) : (
        <Empty title="Inbox is clear" action={<button className="btn-quiet" onClick={() => ui.openCapture()}>Capture something</button>}>
          Anything you save with only the idea itself waits here, so capture never needs to slow you down.
        </Empty>
      )}
    </Page>
  );
}
