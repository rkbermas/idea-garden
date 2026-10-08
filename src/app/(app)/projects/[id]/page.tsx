"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { Markdown } from "@/components/markdown";
import { WikiEditor } from "@/components/wiki-editor";
import { Empty, IdeaRow, Section } from "@/components/idea-bits";
import { searchIdeas } from "@/lib/search";
import { displayTitle, normalize, plural, relativeTime } from "@/lib/text";
import { parseWikiLinks } from "@/lib/wiki";
import { useTitle } from "@/lib/use-title";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const router = useRouter();
  const project = lib.projectById.get(id);
  useTitle(project?.name ?? "Project");
  const [name, setName] = useState(project?.name ?? "");
  const [desc, setDesc] = useState(project?.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    setName(project?.name ?? "");
    setDesc(project?.description ?? "");
    setEditingDesc(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ideas = useMemo(
    () =>
      (lib.ideasByProject.get(id) ?? [])
        .map((x) => lib.ideaById.get(x)!)
        .filter((i) => i && !i.archived)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [lib.ideasByProject, lib.ideaById, id]
  );
  const ids = useMemo(() => new Set(ideas.map((i) => i.id)), [ideas]);

  // Ideas mentioned with [[ ]] in the notes but not yet added to the project.
  const mentioned = useMemo(() => {
    const out: string[] = [];
    for (const r of parseWikiLinks(project?.description)) {
      const target = lib.titleIndex.get(normalize(r.target));
      if (target && !ids.has(target) && !out.includes(target)) out.push(target);
    }
    return out;
  }, [project?.description, lib.titleIndex, ids]);

  const candidates = useMemo(() => {
    if (!adding.trim()) return [];
    return searchIdeas(lib.records.filter((r) => !r.idea.archived && !ids.has(r.idea.id)), adding).slice(0, 6);
  }, [adding, lib.records, ids]);

  if (!project) {
    return (
      <Page>
        <h1 className="font-serif text-title">This project isn&apos;t in your garden</h1>
        <Link href="/" className="btn-quiet mt-5">Home</Link>
      </Page>
    );
  }

  return (
    <Page>
      <p className="text-sm text-stem">Project, updated {relativeTime(project.updated_at)}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== project.name && lib.updateProject(id, { name: name.trim() })}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Project name"
        className="mt-1 w-full bg-transparent font-serif text-display font-medium tracking-[-0.01em] text-ink outline-none"
      />

      <div className="mt-4">
        {editingDesc ? (
          <div className="rounded-md border border-juniper/30 bg-sheet px-4 py-3">
            <WikiEditor
              value={desc}
              onChange={setDesc}
              autoFocus
              minRows={3}
              placeholder="What is this project for? Type [[ to reference ideas."
              className="prose-idea min-h-[5rem]"
              onSubmit={() => {
                lib.updateProject(id, { description: desc.trim() || null });
                setEditingDesc(false);
              }}
            />
            <div className="mt-2 flex justify-end gap-2 border-t border-line pt-2">
              <button className="btn-ghost h-7 px-2.5 text-xs" onClick={() => { setDesc(project.description ?? ""); setEditingDesc(false); }}>
                Cancel
              </button>
              <button className="btn-quiet h-7 px-2.5 text-xs" onClick={() => { lib.updateProject(id, { description: desc.trim() || null }); setEditingDesc(false); }}>
                Save notes
              </button>
            </div>
          </div>
        ) : project.description ? (
          <div className="group cursor-text" onDoubleClick={() => setEditingDesc(true)}>
            <Markdown text={project.description} />
            <button className="mt-1 text-sm text-faint hover:text-ink" onClick={() => setEditingDesc(true)}>
              Edit notes
            </button>
          </div>
        ) : (
          <button className="text-sm text-faint hover:text-stem" onClick={() => setEditingDesc(true)}>
            Add notes: what question or piece of writing is this for?
          </button>
        )}
      </div>

      {mentioned.length > 0 && (
        <div className="mt-6 rounded-md border border-dashed border-line px-4 py-3 text-sm">
          <p className="text-stem">Mentioned in your notes but not in the project:</p>
          <ul className="mt-2 space-y-1">
            {mentioned.map((mid) => (
              <li key={mid} className="flex items-center justify-between gap-3">
                <Link href={`/ideas/${mid}`} className="font-serif text-ink hover:text-juniper">
                  {displayTitle(lib.ideaById.get(mid)!)}
                </Link>
                <button className="text-xs text-stem hover:text-ink" onClick={() => lib.toggleIdeaProject(mid, id)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section
        title={plural(ideas.length, "idea")}
        className="mt-12"
        action={
          <button className="inline-flex items-center gap-1.5 text-sm text-stem hover:text-ink" onClick={() => ui.openCapture({ projectIds: [id] })}>
            <Plus size={14} /> New idea here
          </button>
        }
      >
        {ideas.length ? (
          <div className="divide-y divide-line/70">
            {ideas.map((i) => (
              <IdeaRow
                key={i.id}
                idea={i}
                aside={
                  <button className="inline-flex items-center gap-1 text-xs text-faint hover:text-ink" onClick={() => lib.toggleIdeaProject(i.id, id)}>
                    <X size={11} /> Remove from project
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <Empty title="No ideas in this project yet">Add ideas you already have below, or capture a new one here.</Empty>
        )}
        <div className="relative mt-5">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add an existing idea" className="field h-9 text-sm" aria-label="Add existing idea" />
          {candidates.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
              {candidates.map(({ idea }) => (
                <button
                  key={idea.id}
                  className="block w-full truncate px-3 py-1.5 text-left font-serif hover:bg-moss"
                  onClick={() => {
                    lib.toggleIdeaProject(idea.id, id);
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

      <div className="mt-16 border-t border-line pt-4">
        <button
          className="btn-danger -ml-3 h-8 px-2.5"
          onClick={() => {
            if (!window.confirm(`Delete “${project.name}”? Its ideas stay in your garden.`)) return;
            lib.deleteProject(id);
            toast.show("Project deleted.");
            router.push("/");
          }}
        >
          Delete project
        </button>
      </div>
    </Page>
  );
}
