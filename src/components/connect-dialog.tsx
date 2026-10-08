"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { useLibrary } from "./library";
import { useUI } from "./ui-state";
import { useToast } from "./toast";
import { GrowthMark } from "./idea-bits";
import { searchIdeas } from "@/lib/search";
import { similarityLabel } from "@/lib/similarity";
import { callAI } from "@/lib/ai-client";
import { cx, displayTitle, previewText } from "@/lib/text";
import { RELATIONSHIPS, type RelationshipType } from "@/lib/types";

export function RelationshipPicker({ value, onChange }: { value: RelationshipType | null; onChange(v: RelationshipType | null): void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of connection">
      {[{ value: null, label: "just connected" }, ...RELATIONSHIPS].map((r) => (
        <button
          key={r.value ?? "none"}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value as RelationshipType | null)}
          className={cx(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            value === r.value
              ? r.value === "contradicts"
                ? "border-rust/50 bg-rust/10 text-ink"
                : "border-juniper/50 bg-moss text-ink"
              : "border-line text-stem hover:border-faint/60 hover:text-ink"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function ConnectDialog() {
  const ui = useUI();
  const lib = useLibrary();
  const toast = useToast();
  const id = ui.connectFor;
  const idea = id ? lib.ideaById.get(id) : undefined;
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [rel, setRel] = useState<RelationshipType | null>(null);
  const [ai, setAi] = useState<{ state: "idle" | "loading" | "done" | "error"; items: { id: string; strength: string; reason: string }[]; error?: string }>({ state: "idle", items: [] });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      setQ("");
      setPicked(null);
      setRel(null);
      setAi({ state: "idle", items: [] });
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ui.closeConnect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, ui]);

  const connected = useMemo(() => new Set((id ? lib.connections.get(id) ?? [] : []).map((c) => c.otherId)), [id, lib.connections]);

  const suggestions = useMemo(() => {
    if (!id) return [];
    return lib.similarity.similar(id, 5, connected);
  }, [id, lib.similarity, connected]);

  const results = useMemo(() => {
    if (!id || !q.trim()) return [];
    return searchIdeas(lib.records.filter((r) => !r.idea.archived && r.idea.id !== id), q).slice(0, 8);
  }, [q, id, lib.records]);

  if (!id || !idea) return null;

  const pickedIdea = picked ? lib.ideaById.get(picked) : undefined;

  const askAI = async () => {
    setAi({ state: "loading", items: [] });
    try {
      const r = await callAI({ action: "suggest", ideaId: id }, lib.data);
      setAi({ state: "done", items: r.suggestions.filter((s) => lib.ideaById.has(s.id) && s.id !== id && !connected.has(s.id)) });
    } catch (e) {
      setAi({ state: "error", items: [], error: e instanceof Error ? e.message : "No suggestions came back." });
    }
  };

  const save = () => {
    if (!picked) return;
    lib.connect(id, picked, rel);
    toast.show("Connected.");
    ui.closeConnect();
  };

  const Option = ({ oid, note }: { oid: string; note?: React.ReactNode }) => {
    const o = lib.ideaById.get(oid);
    if (!o) return null;
    return (
      <button
        type="button"
        onClick={() => setPicked(oid)}
        className={cx("flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left transition-colors", picked === oid ? "bg-moss" : "hover:bg-sunk")}
      >
        <GrowthMark degree={lib.degree.get(oid) ?? 0} className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[1.0625rem] leading-6 text-ink">{displayTitle(o)}</span>
          {note ?? <span className="line-clamp-1 text-sm text-stem">{previewText(o, 100)}</span>}
        </span>
        {connected.has(oid) && <span className="text-xs text-faint">connected</span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-start sm:px-4 sm:pt-[10vh]" role="dialog" aria-modal="true" aria-label="Connect idea">
      <div className="absolute inset-0 animate-fade bg-ink/25 dark:bg-black/50" onClick={ui.closeConnect} />
      <div className="relative flex max-h-[88vh] w-full max-w-xl animate-rise flex-col rounded-t-lg border border-line bg-sheet shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)] sm:rounded-lg">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-sm text-stem">Connect</p>
            <p className="truncate font-serif text-read font-medium text-ink">{displayTitle(idea)}</p>
          </div>
          <button className="btn-ghost h-8 w-8 shrink-0 px-0" onClick={ui.closeConnect} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {pickedIdea ? (
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="text-sm text-stem">to</p>
              <p className="font-serif text-read text-ink">{displayTitle(pickedIdea)}</p>
            </div>
            <div>
              <p className="label">How are they related? Optional.</p>
              <RelationshipPicker value={rel} onChange={setRel} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setPicked(null)}>
                Back
              </button>
              <button className="btn-primary" onClick={save} autoFocus>
                Connect ideas
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-line px-5">
              <Search size={15} className="text-faint" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) setPicked(results[0].idea.id);
                }}
                placeholder="Find an idea to connect"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
              {q.trim() ? (
                results.length ? (
                  results.map((r) => <Option key={r.idea.id} oid={r.idea.id} />)
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-stem">No ideas match “{q}”.</p>
                )
              ) : (
                <>
                  {suggestions.length > 0 && (
                    <>
                      <p className="px-3 pb-1 pt-1 text-xs text-faint">May connect to</p>
                      {suggestions.map((s) => (
                        <Option
                          key={s.id}
                          oid={s.id}
                          note={<span className="text-sm text-stem">Similarity: {similarityLabel(s.score)}</span>}
                        />
                      ))}
                    </>
                  )}
                  {ui.ai.enabled && (
                    <div className="px-3 pb-1 pt-3">
                      {ai.state === "idle" && (
                        <button className="btn-quiet h-8" onClick={askAI}>
                          <Sparkles size={14} strokeWidth={1.75} /> Suggest connections by meaning
                        </button>
                      )}
                      {ai.state === "loading" && <p className="text-sm text-stem">Reading your library…</p>}
                      {ai.state === "error" && <p className="text-sm text-rust">{ai.error}</p>}
                    </div>
                  )}
                  {ai.state === "done" &&
                    (ai.items.length ? (
                      <>
                        <p className="px-3 pb-1 pt-2 text-xs text-faint">Suggested by meaning</p>
                        {ai.items.map((s) => (
                          <Option
                            key={s.id}
                            oid={s.id}
                            note={
                              <span className="block text-sm text-stem">
                                Similarity: {s.strength}. {s.reason}
                              </span>
                            }
                          />
                        ))}
                      </>
                    ) : (
                      <p className="px-3 py-2 text-sm text-stem">Nothing else in your library looks closely related.</p>
                    ))}
                </>
              )}
            </div>
            <div className="border-t border-line px-5 py-3">
              <button
                className="btn-ghost -ml-2 h-8 px-2"
                onClick={() => {
                  ui.closeConnect();
                  ui.openCapture({ title: q.trim() || undefined, connectTo: id });
                }}
              >
                <Plus size={15} /> Write a new connected idea
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
