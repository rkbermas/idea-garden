"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLibrary } from "./library";
import { cx, normalize, normalizeTag } from "@/lib/text";
import { SOURCE_TYPES, type Source, type SourceType } from "@/lib/types";

export function TagInput({
  value,
  onChange,
  placeholder = "Add tags",
  autoFocus,
}: {
  value: string[];
  onChange(v: string[]): void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const { data, ideasByTag } = useLibrary();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = normalizeTag(text);
    return data.tags
      .filter((t) => !value.includes(t.name) && (!q || t.name.includes(q)))
      .sort((a, b) => {
        const ap = q && a.name.startsWith(q) ? 1 : 0;
        const bp = q && b.name.startsWith(q) ? 1 : 0;
        return bp - ap || (ideasByTag.get(b.id)?.length ?? 0) - (ideasByTag.get(a.id)?.length ?? 0);
      })
      .slice(0, 6);
  }, [data.tags, value, text, ideasByTag]);

  const add = (raw: string) => {
    const names = raw
      .split(",")
      .map(normalizeTag)
      .filter((n) => n && !value.includes(n));
    if (names.length) onChange([...value, ...names]);
    setText("");
    setActive(0);
  };

  const show = focused && (suggestions.length > 0 || text.trim());

  return (
    <div className="relative">
      <div
        className="field flex min-h-10 flex-wrap items-center gap-1.5 py-1.5"
        onClick={() => input.current?.focus()}
      >
        {value.map((t) => (
          <span key={t} className="chip bg-moss text-ink">
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              className="-mr-0.5 rounded-sm p-0.5 text-stem hover:text-ink"
              onClick={(e) => {
                e.stopPropagation();
                onChange(value.filter((x) => x !== t));
              }}
            >
              <X size={11} strokeWidth={2.25} />
            </button>
          </span>
        ))}
        <input
          ref={input}
          value={text}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (text.trim()) add(text);
          }}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v);
            else setText(v);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              // Let the surrounding form treat ⌘/Ctrl+Enter as "save"; keep any typed tag.
              if (text.trim()) add(text);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions[active] && (!text.trim() || active > 0 || suggestions[active].name.startsWith(normalizeTag(text))))
                add(suggestions[active].name);
              else if (text.trim()) add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-faint"
          aria-label="Tags"
        />
      </div>
      {show && (
        <div className="absolute z-30 mt-1 w-full max-w-xs animate-sprout overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
          {suggestions.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(t.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm", i === active ? "bg-moss" : "")}
            >
              <span>{t.name}</span>
              <span className="text-xs text-faint">{ideasByTag.get(t.id)?.length ?? 0}</span>
            </button>
          ))}
          {text.trim() && !data.tags.some((t) => t.name === normalizeTag(text)) && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(text);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-stem hover:bg-moss"
            >
              Create tag “{normalizeTag(text)}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface SourceDraft {
  sourceId: string | null;
  title: string;
  author: string;
  type: SourceType;
  location: string;
}

export const emptySourceDraft = (): SourceDraft => ({ sourceId: null, title: "", author: "", type: "book", location: "" });

export function draftFromSource(s: Source | undefined, location: string | null): SourceDraft {
  if (!s) return { ...emptySourceDraft(), location: location ?? "" };
  return { sourceId: s.id, title: s.title, author: s.author ?? "", type: s.source_type, location: location ?? "" };
}

export function SourceFields({ draft, onChange }: { draft: SourceDraft; onChange(d: SourceDraft): void }) {
  const { data, ideasBySource } = useLibrary();
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = normalize(draft.title);
    return data.sources
      .filter((s) => !q || normalize(s.title).includes(q) || normalize(s.author ?? "").includes(q))
      .sort((a, b) => (ideasBySource.get(b.id)?.length ?? 0) - (ideasBySource.get(a.id)?.length ?? 0))
      .slice(0, 6);
  }, [data.sources, draft.title, ideasBySource]);

  const pick = (s: Source) => {
    onChange({ ...draft, sourceId: s.id, title: s.title, author: s.author ?? "", type: s.source_type });
    setOpen(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="label">Kind of source</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kind of source">
          {SOURCE_TYPES.filter((t) => t.value !== "website").map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={draft.type === t.value}
              onClick={() => onChange({ ...draft, type: t.value, sourceId: draft.sourceId && draft.type === t.value ? draft.sourceId : null })}
              className={cx(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                draft.type === t.value ? "border-juniper/50 bg-moss text-ink" : "border-line text-stem hover:border-faint/60 hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <label className="label" htmlFor="src-title">
            {draft.type === "conversation" ? "Conversation" : draft.type === "observation" ? "Context" : "Title"}
          </label>
          <input
            id="src-title"
            className="field"
            value={draft.title}
            autoComplete="off"
            placeholder={draft.type === "conversation" ? "Coffee with Sam" : draft.type === "observation" ? "Morning walks" : "Where did this come from?"}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={(e) => onChange({ ...draft, title: e.target.value, sourceId: null })}
          />
          {open && matches.length > 0 && !draft.sourceId && (
            <div className="absolute z-30 mt-1 w-full animate-sprout overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]">
              <div className="px-3 pb-1 pt-1 text-xs text-faint">Your sources</div>
              {matches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                  className="block w-full px-3 py-1.5 text-left hover:bg-moss"
                >
                  <span className="block truncate font-serif text-sm italic">{s.title}</span>
                  {s.author && <span className="block truncate text-xs text-stem">{s.author}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label" htmlFor="src-author">
            {draft.type === "conversation" ? "With" : "Author"}
          </label>
          <input
            id="src-author"
            className="field"
            value={draft.author}
            placeholder={draft.type === "conversation" ? "Who said it" : "Optional"}
            onChange={(e) => onChange({ ...draft, author: e.target.value, sourceId: null })}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="src-loc">
          Location
        </label>
        <input
          id="src-loc"
          className="field"
          value={draft.location}
          placeholder="Chapter, page, section or timestamp"
          onChange={(e) => onChange({ ...draft, location: e.target.value })}
        />
      </div>
    </div>
  );
}
