"use client";

import { useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { PageHeader } from "@/components/idea-bits";
import { cx, displayTitle, plural } from "@/lib/text";
import { relationshipLabel, sourceTypeLabel } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-line py-6 sm:grid-cols-[14rem_1fr] sm:gap-8">
      <div>
        <h2 className="font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-stem">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const SHORTCUTS: [string, string][] = [
  ["N", "New idea"],
  ["/", "Search"],
  ["⌘K or Ctrl K", "Command palette"],
  ["G", "Connections graph"],
  ["R", "Random idea"],
  ["E", "Edit the open idea"],
  ["[[", "Link to another idea while writing"],
  ["⌘↵ or Ctrl ↵", "Save or finish editing"],
  ["⌘B, ⌘I", "Bold, italic"],
  ["Esc", "Close a dialog"],
];

export default function SettingsPage() {
  useTitle("Settings");
  const lib = useLibrary();
  const ui = useUI();
  const [name, setName] = useState(lib.profile.display_name ?? "");
  const [tagEdit, setTagEdit] = useState<{ id: string; name: string } | null>(null);
  const samples = lib.data.ideas.filter((i) => i.is_sample).length;
  const today = new Date().toISOString().slice(0, 10);

  const exportMarkdown = () => {
    const parts = lib.ideas.map((i) => {
      const src = i.source_id ? lib.sourceById.get(i.source_id) : undefined;
      const tags = (lib.tagsByIdea.get(i.id) ?? []).map((t) => `#${t.name}`).join(" ");
      const topics = (lib.topicsByIdea.get(i.id) ?? []).map((t) => t.name).join(", ");
      const conns = (lib.data.links ?? [])
        .filter((l) => l.source_idea_id === i.id)
        .map((l) => `- ${relationshipLabel(l.relationship_type, true)} [[${displayTitle(lib.ideaById.get(l.target_idea_id) ?? { title: "?", content: "" })}]]`);
      const refl = (lib.reflectionsByIdea.get(i.id) ?? []).map((r) => `- ${r.created_at.slice(0, 10)}: ${r.content}`);
      return [
        `## ${displayTitle(i)}`,
        "",
        i.content,
        "",
        src ? `Source: *${src.title}*${src.author ? `, ${src.author}` : ""}${i.source_location ? `, ${i.source_location}` : ""} (${sourceTypeLabel(src.source_type).toLowerCase()})` : null,
        topics ? `Topics: ${topics}` : null,
        tags ? `Tags: ${tags}` : null,
        `Captured: ${i.created_at.slice(0, 10)}`,
        i.personal_thoughts ? `\n### My thoughts\n\n${i.personal_thoughts}` : null,
        refl.length ? `\n### Reflections\n\n${refl.join("\n")}` : null,
        conns.length ? `\n### Connections\n\n${conns.join("\n")}` : null,
      ]
        .filter((x) => x !== null)
        .join("\n");
    });
    download(`idea-garden-${today}.md`, `# Idea Garden\n\nExported ${today}. ${plural(lib.ideas.length, "idea")}.\n\n${parts.join("\n\n---\n\n")}\n`, "text/markdown");
  };

  return (
    <Page width="wide">
      <div className="mx-auto max-w-[48rem]">
        <PageHeader title="Settings" />

        <Row title="Your name" description="Used in the greeting on Home.">
          <form
            className="flex max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lib.updateProfile({ display_name: name.trim() || null });
            }}
          >
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
            <button className="btn-quiet" disabled={name.trim() === (lib.profile.display_name ?? "")}>
              Save
            </button>
          </form>
        </Row>

        <Row title="Appearance">
          <div className="inline-flex rounded-md border border-line p-0.5" role="radiogroup" aria-label="Theme">
            {(
              [
                ["system", "Match device", Monitor],
                ["light", "Light", Sun],
                ["dark", "Dark", Moon],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                role="radio"
                aria-checked={lib.profile.theme === v}
                onClick={() => lib.updateProfile({ theme: v })}
                className={cx("inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm", lib.profile.theme === v ? "bg-moss text-ink" : "text-stem hover:text-ink")}
              >
                <Icon size={14} strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-stem">
            The sidebar is {ui.sidebarCollapsed ? "collapsed" : "expanded"}.{" "}
            <button className="underline decoration-line underline-offset-4 hover:text-ink" onClick={ui.toggleSidebar}>
              {ui.sidebarCollapsed ? "Expand it" : "Collapse it"}
            </button>
          </p>
        </Row>

        <Row title="Tags" description="Rename a tag everywhere at once, or remove it.">
          {lib.data.tags.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {[...lib.data.tags]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) =>
                  tagEdit?.id === t.id ? (
                    <li key={t.id}>
                      <form
                        className="flex items-center gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          lib.renameTag(t.id, tagEdit.name);
                          setTagEdit(null);
                        }}
                      >
                        <input autoFocus className="field h-7 w-32 px-2 py-0.5 text-xs" value={tagEdit.name} onChange={(e) => setTagEdit({ id: t.id, name: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setTagEdit(null)} />
                        <button className="text-xs text-stem hover:text-ink">Save</button>
                        <button
                          type="button"
                          className="text-xs text-rust hover:underline"
                          onClick={() => {
                            if (window.confirm(`Remove the tag “${t.name}” from ${plural(lib.ideasByTag.get(t.id)?.length ?? 0, "idea")}?`)) lib.deleteTag(t.id);
                            setTagEdit(null);
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </li>
                  ) : (
                    <li key={t.id}>
                      <button className="chip" onClick={() => setTagEdit({ id: t.id, name: t.name })} title="Rename or delete">
                        {t.name} <span className="text-faint">{lib.ideasByTag.get(t.id)?.length ?? 0}</span>
                      </button>
                    </li>
                  )
                )}
            </ul>
          ) : (
            <p className="text-sm text-faint">Tags you add to ideas appear here.</p>
          )}
        </Row>

        <Row title="Keyboard shortcuts">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <span className="kbd">{k}</span>
                </dt>
                <dd className="text-stem">{v}</dd>
              </div>
            ))}
          </dl>
        </Row>

        <Row title="Export" description="Your ideas are yours. Download them any time.">
          <div className="flex flex-wrap gap-2">
            <button className="btn-quiet" onClick={exportMarkdown}>
              Download as Markdown
            </button>
            <button className="btn-quiet" onClick={() => download(`idea-garden-${today}.json`, JSON.stringify({ exported_at: new Date().toISOString(), ...lib.data }, null, 2), "application/json")}>
              Download as JSON
            </button>
          </div>
        </Row>

        <Row title="Sample garden" description="The ideas planted on first launch. All sources in it are fictional.">
          {samples > 0 ? (
            <button
              className="btn-quiet"
              onClick={() => {
                if (window.confirm(`Remove ${plural(samples, "sample idea")}? Ideas you wrote stay, and tags or topics you've used on them are kept.`)) void lib.clearSamples();
              }}
            >
              Remove {plural(samples, "sample idea")}
            </button>
          ) : (
            <button className="btn-quiet" onClick={() => void lib.plantSamples()}>
              Plant the sample garden again
            </button>
          )}
        </Row>

        <Row title="Delete everything" description="Removes every idea, source, tag, topic and project. This can't be undone.">
          <button
            className="btn-danger border border-rust/30"
            onClick={() => {
              const typed = window.prompt(`This deletes ${plural(lib.data.ideas.length, "idea")} permanently. Type DELETE to confirm.`);
              if (typed === "DELETE") void lib.deleteEverything();
            }}
          >
            Delete all my ideas
          </button>
        </Row>
      </div>
    </Page>
  );
}
