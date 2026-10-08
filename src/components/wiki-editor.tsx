"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLibrary } from "./library";
import { activeWikiQuery } from "@/lib/wiki";
import { cx, displayTitle, normalize } from "@/lib/text";
import type { Idea } from "@/lib/types";

interface Props {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  autoFocus?: boolean;
  excludeId?: string;
  onSubmit?(): void;
  onBlur?(): void;
  ariaLabel?: string;
}

export interface WikiEditorHandle {
  focus(): void;
  insertLink(): void;
}

const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariationSettings",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "tabSize",
] as const;

function caretCoords(el: HTMLTextAreaElement, pos: number) {
  const div = document.createElement("div");
  const style = getComputedStyle(el);
  for (const p of MIRROR_PROPS) (div.style as unknown as Record<string, string>)[p] = style[p as keyof CSSStyleDeclaration] as string;
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement("span");
  span.textContent = el.value.slice(pos) || ".";
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft;
  const lh = parseFloat(style.lineHeight) || 24;
  document.body.removeChild(div);
  return { top: top + lh, left };
}

export const WikiEditor = forwardRef<WikiEditorHandle, Props>(function WikiEditor(
  { value, onChange, placeholder, className, minRows = 3, autoFocus, excludeId, onSubmit, onBlur, ariaLabel },
  ref
) {
  const lib = useLibrary();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);
  /** Caret position to restore right after React commits a programmatic edit. */
  const pendingCaret = useRef<[number, number] | null>(null);

  useImperativeHandle(ref, () => ({
    focus: () => ta.current?.focus(),
    insertLink: () => {
      const el = ta.current;
      if (!el) return;
      const s = el.selectionStart;
      const next = value.slice(0, s) + "[[" + value.slice(el.selectionEnd);
      pendingCaret.current = [s + 2, s + 2];
      onChange(next);
      requestAnimationFrame(refresh);
    },
  }));

  // Auto-grow, and place the caret after programmatic edits before the next keystroke lands.
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingCaret.current) {
      const [a, b] = pendingCaret.current;
      pendingCaret.current = null;
      el.focus();
      el.setSelectionRange(a, b);
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus) {
      const el = ta.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [autoFocus]);

  const refresh = useCallback(() => {
    const el = ta.current;
    if (!el) return;
    const q = activeWikiQuery(el.value, el.selectionStart);
    setQuery(q);
    if (q) {
      const c = caretCoords(el, q.start);
      setPos({ top: c.top, left: Math.min(c.left, el.clientWidth - 280) });
      setActive(0);
    }
  }, []);

  const matches = useMemo(() => {
    if (!query) return [] as Idea[];
    const q = normalize(query.query);
    const pool = lib.ideas.filter((i) => i.id !== excludeId);
    if (!q) return pool.slice(0, 7);
    const scored: { idea: Idea; s: number }[] = [];
    for (const i of pool) {
      const t = normalize(displayTitle(i));
      let s = 0;
      if (t === q) s = 100;
      else if (t.startsWith(q)) s = 60;
      else if (t.split(" ").some((w) => w.startsWith(q))) s = 40;
      else if (t.includes(q)) s = 25;
      else if (q.split(" ").every((w) => t.includes(w))) s = 15;
      if (s) scored.push({ idea: i, s: s + (lib.degree.get(i.id) ?? 0) * 0.1 });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, 7).map((x) => x.idea);
  }, [query, lib.ideas, lib.degree, excludeId]);

  const exact = query && matches.some((i) => normalize(displayTitle(i)) === normalize(query.query));
  const options: ({ kind: "idea"; idea: Idea } | { kind: "new"; title: string })[] = [
    ...matches.map((idea) => ({ kind: "idea" as const, idea })),
    ...(query && query.query.trim() && !exact ? [{ kind: "new" as const, title: query.query.trim() }] : []),
  ];

  const choose = (i: number) => {
    const el = ta.current;
    const opt = options[i];
    if (!el || !query || !opt) return;
    let title: string;
    if (opt.kind === "idea") {
      title = displayTitle(opt.idea);
      // Give untitled ideas a stable title so the link survives later edits.
      if (!opt.idea.title?.trim()) lib.updateIdea(opt.idea.id, { title });
    } else title = opt.title;
    const caret = el.selectionStart;
    const after = value.slice(caret).replace(/^[^\]\n]*\]\]/, "");
    const insert = `[[${title}]]`;
    const next = value.slice(0, query.start) + insert + after;
    const p = query.start + insert.length;
    pendingCaret.current = [p, p];
    onChange(next);
    setQuery(null);
  };

  const wrap = (mark: string) => {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b);
    pendingCaret.current = [a + mark.length, b + mark.length];
    onChange(value.slice(0, a) + mark + sel + mark + value.slice(b));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query && options.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        choose(active);
        return;
      }
    }
    if (query && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter" && onSubmit) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (mod && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      wrap("**");
    } else if (mod && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      wrap("*");
    } else if (mod && e.shiftKey && (e.key === "h" || e.key === "H")) {
      e.preventDefault();
      wrap("==");
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={ta}
        value={value}
        rows={minRows}
        aria-label={ariaLabel}
        placeholder={placeholder}
        spellCheck
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(refresh);
        }}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) refresh();
        }}
        onClick={refresh}
        onBlur={() => {
          window.setTimeout(() => setQuery(null), 120);
          onBlur?.();
        }}
        className={cx("block w-full overflow-hidden bg-transparent outline-none placeholder:text-faint", className)}
      />
      {query && options.length > 0 && (
        <div
          role="listbox"
          className="absolute z-30 w-[min(20rem,calc(100vw-3rem))] animate-sprout overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]"
          style={{ top: pos.top + 4, left: Math.max(0, pos.left) }}
        >
          <div className="px-3 pb-1 pt-1.5 text-xs text-faint">Link to an idea</div>
          {options.map((o, i) => (
            <button
              key={o.kind === "idea" ? o.idea.id : "new"}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                "block w-full truncate px-3 py-1.5 text-left font-sans text-sm",
                i === active ? "bg-moss text-ink" : "text-stem"
              )}
            >
              {o.kind === "idea" ? displayTitle(o.idea) : <span>Link to new idea “{o.title}”</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
