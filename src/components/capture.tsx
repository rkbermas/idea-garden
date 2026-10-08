"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Feather, Tag as TagIcon, X } from "lucide-react";
import { useLibrary } from "./library";
import { useUI, type CapturePrefill } from "./ui-state";
import { useToast } from "./toast";
import { WikiEditor, type WikiEditorHandle } from "./wiki-editor";
import { TagInput, SourceFields, emptySourceDraft, type SourceDraft } from "./fields";
import { cx } from "@/lib/text";

const DRAFT_KEY = "idea-garden:draft";

interface Draft {
  title: string;
  content: string;
  thoughts: string;
  tags: string[];
  source: SourceDraft;
}

const emptyDraft = (): Draft => ({ title: "", content: "", thoughts: "", tags: [], source: emptySourceDraft() });

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft(), ...(JSON.parse(raw) as Draft) } : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d && (d.content.trim() || d.thoughts.trim())) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function CaptureForm({
  variant,
  prefill,
  onDone,
  onCancel,
}: {
  variant: "modal" | "inline";
  prefill?: CapturePrefill | null;
  onDone?(id: string): void;
  onCancel?(draftKept: boolean): void;
}) {
  const lib = useLibrary();
  const toast = useToast();
  const router = useRouter();
  const editor = useRef<WikiEditorHandle>(null);
  const [d, setD] = useState<Draft>(() => {
    const base = emptyDraft();
    if (prefill) {
      const src = prefill.sourceId ? lib.sourceById.get(prefill.sourceId) : undefined;
      return {
        ...base,
        title: prefill.title ?? "",
        content: prefill.content ?? "",
        tags: prefill.tags ?? [],
        source: src ? { sourceId: src.id, title: src.title, author: src.author ?? "", type: src.source_type, location: "" } : base.source,
      };
    }
    return variant === "modal" ? readDraft() ?? base : base;
  });
  const [showSource, setShowSource] = useState(variant === "modal" ? !!d.source.title : false);
  const [showThoughts, setShowThoughts] = useState(!!d.thoughts);
  const [showTags, setShowTags] = useState(variant === "modal" || d.tags.length > 0);
  const [details, setDetails] = useState(variant === "modal");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const hasDetails = !!(d.title.trim() || d.thoughts.trim() || d.tags.length || d.source.title.trim() || prefill?.topicIds?.length || prefill?.projectIds?.length);
  const canSave = d.content.trim().length > 0;

  // Keep modal drafts so closing by accident never loses a thought.
  useEffect(() => {
    if (variant !== "modal") return;
    const t = window.setTimeout(() => writeDraft(d), 300);
    return () => window.clearTimeout(t);
  }, [d, variant]);

  const save = () => {
    if (!canSave) {
      editor.current?.focus();
      return;
    }
    const status = hasDetails ? "active" : "inbox";
    const id = lib.createIdea({
      title: d.title,
      content: d.content,
      personal_thoughts: d.thoughts,
      sourceId: d.source.sourceId,
      newSource: d.source.sourceId ? null : d.source.title.trim() ? { title: d.source.title, author: d.source.author, source_type: d.source.type } : null,
      source_location: d.source.location,
      tags: d.tags,
      topicIds: prefill?.topicIds,
      projectIds: prefill?.projectIds,
      status,
    });
    if (prefill?.connectTo) lib.connect(prefill.connectTo, id, null);
    writeDraft(null);
    toast.show(status === "inbox" ? "Saved to Inbox." : "Idea saved.", {
      action: { label: "Open", run: () => router.push(`/ideas/${id}`) },
    });
    const keepSource = variant === "inline" ? d.source : emptySourceDraft();
    setD({ ...emptyDraft(), source: { ...keepSource, location: "" } });
    onDone?.(id);
    if (variant === "inline") editor.current?.focus();
  };

  const isModal = variant === "modal";
  // Latest save, so a deferred call sees state updated in the same keystroke (e.g. a just-added tag).
  const saveRef = useRef(save);
  saveRef.current = save;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        // ⌘/Ctrl+Enter saves from any field. The idea editors handle it themselves.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.defaultPrevented) {
          e.preventDefault();
          window.setTimeout(() => saveRef.current(), 0);
        }
      }}
      className={cx("flex flex-col", isModal ? "h-full" : "")}
    >
      <div className={cx(isModal ? "flex-1 overflow-y-auto px-5 pb-6 pt-5 scrollbar-thin sm:px-8" : "px-5 pb-3 pt-4 sm:px-6")}>
        {(isModal || details) && (
          <input
            value={d.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Title (optional)"
            aria-label="Title"
            className="mb-2 w-full bg-transparent font-serif text-title font-medium text-ink outline-none placeholder:text-faint/70"
          />
        )}
        <WikiEditor
          ref={editor}
          value={d.content}
          onChange={(v) => set("content", v)}
          onSubmit={save}
          autoFocus={isModal}
          minRows={isModal ? 5 : 2}
          ariaLabel="Idea"
          placeholder={isModal ? "Write the idea in your own words. Type [[ to link another idea." : "What idea do you want to remember?"}
          className={cx("font-serif text-ink", isModal ? "min-h-[8rem] text-lead" : "min-h-[3.5rem] text-lead")}
        />

        {(isModal || details) && (
          <div className="mt-5 space-y-5 animate-fade">
            {showSource ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-ink">Source</h3>
                  <button type="button" className="text-xs text-stem hover:text-ink" onClick={() => { setShowSource(false); set("source", emptySourceDraft()); }}>
                    Remove
                  </button>
                </div>
                <SourceFields draft={d.source} onChange={(s) => set("source", s)} />
              </section>
            ) : null}
            {showThoughts ? (
              <section>
                <label className="label" htmlFor="thoughts">My thoughts</label>
                <WikiEditor
                  value={d.thoughts}
                  onChange={(v) => set("thoughts", v)}
                  onSubmit={save}
                  minRows={2}
                  ariaLabel="My thoughts"
                  placeholder="What does this mean to you? Where might it apply?"
                  className="field min-h-[4.5rem] font-serif text-[1.0625rem] leading-7"
                />
              </section>
            ) : null}
            {showTags ? (
              <section>
                <span className="label">Tags</span>
                <TagInput value={d.tags} onChange={(v) => set("tags", v)} />
              </section>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {!showSource && (
                <button type="button" className="btn-ghost h-8 px-2.5" onClick={() => setShowSource(true)}>
                  <BookOpen size={15} strokeWidth={1.75} /> Add source
                </button>
              )}
              {!showThoughts && (
                <button type="button" className="btn-ghost h-8 px-2.5" onClick={() => setShowThoughts(true)}>
                  <Feather size={15} strokeWidth={1.75} /> Add my thoughts
                </button>
              )}
              {!showTags && (
                <button type="button" className="btn-ghost h-8 px-2.5" onClick={() => setShowTags(true)}>
                  <TagIcon size={15} strokeWidth={1.75} /> Add tags
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className={cx(
          "flex items-center gap-3 border-t border-line",
          isModal ? "px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8" : "px-5 py-2.5 sm:px-6"
        )}
      >
        {!isModal && (
          <button type="button" className="btn-ghost -ml-2 h-8 px-2" onClick={() => setDetails((v) => !v)} aria-expanded={details}>
            {details ? "Hide details" : "Add details"}
          </button>
        )}
        <p className="hidden flex-1 text-xs text-faint sm:block">
          {canSave ? (hasDetails ? "Saves to your ideas." : "Saves to Inbox. Add details now or later.") : isModal ? "Type [[ to link an idea." : ""}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {isModal && (
            <button type="button" className="btn-ghost" onClick={() => onCancel?.(!!d.content.trim())}>
              Close
            </button>
          )}
          <button type="submit" className="btn-primary" disabled={!canSave}>
            Save idea
            <span className="hidden items-center gap-0.5 text-paper/70 sm:inline-flex">
              <span className="text-xs">⌘</span>
              <span className="text-xs">↵</span>
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

export function CaptureModal() {
  const { capture, closeCapture } = useUI();
  const toast = useToast();
  const [instance, setInstance] = useState(0);

  useEffect(() => {
    if (capture.open) setInstance((n) => n + 1);
  }, [capture.open]);

  useEffect(() => {
    if (!capture.open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [capture.open, closeCapture]);

  if (!capture.open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-start sm:px-4 sm:pt-[8vh]" role="dialog" aria-modal="true" aria-label="Capture an idea">
      <div className="absolute inset-0 animate-fade bg-ink/25 backdrop-blur-[2px] dark:bg-black/50" onClick={closeCapture} />
      <div className="relative flex w-full max-w-2xl animate-rise flex-col bg-sheet sm:max-h-[84vh] sm:rounded-lg sm:border sm:border-line sm:shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]">
        <div className="flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8 sm:pt-5">
          <h2 className="text-sm font-medium text-stem">New idea</h2>
          <button className="btn-ghost h-8 w-8 px-0" onClick={closeCapture} aria-label="Close">
            <X size={17} strokeWidth={1.75} />
          </button>
        </div>
        <CaptureForm
          key={instance}
          variant="modal"
          prefill={capture.prefill}
          onDone={closeCapture}
          onCancel={(kept) => {
            if (kept) toast.show("Draft kept. It'll be here next time you press N.");
            closeCapture();
          }}
        />
      </div>
    </div>
  );
}
