"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Compass,
  CornerDownLeft,
  House,
  Inbox,
  Layers,
  Library,
  Moon,
  Plus,
  Search,
  Settings,
  Shuffle,
  Sun,
  Waypoints,
} from "lucide-react";
import { useLibrary } from "./library";
import { useUI } from "./ui-state";
import { GrowthMark } from "./idea-bits";
import { searchIdeas } from "@/lib/search";
import { cx, displayTitle, normalize, previewText } from "@/lib/text";

interface Item {
  id: string;
  group: string;
  label: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  run(): void;
  keywords?: string;
}

export function CommandPalette() {
  const ui = useUI();
  const lib = useLibrary();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ui.palette.open) {
      setQ(ui.palette.query);
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [ui.palette.open, ui.palette.query]);

  const go = (href: string) => () => {
    ui.closePalette();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const iconProps = { size: 15, strokeWidth: 1.75 } as const;
    const actions: Item[] = [
      { id: "new", group: "Actions", label: "New idea", hint: <span className="kbd">N</span>, icon: <Plus {...iconProps} />, run: () => ui.openCapture(q.trim() ? { content: q.trim() } : undefined), keywords: "capture add create write" },
      { id: "random", group: "Actions", label: "Show a random idea", hint: <span className="kbd">R</span>, icon: <Shuffle {...iconProps} />, run: go("/random"), keywords: "resurface flashcard" },
      {
        id: "theme",
        group: "Actions",
        label: "Switch light or dark",
        icon: document.documentElement.classList.contains("dark") ? <Sun {...iconProps} /> : <Moon {...iconProps} />,
        run: () => {
          const dark = document.documentElement.classList.contains("dark");
          lib.updateProfile({ theme: dark ? "light" : "dark" });
          ui.closePalette();
        },
        keywords: "theme dark light mode appearance",
      },
      { id: "home", group: "Go to", label: "Home", icon: <House {...iconProps} />, run: go("/") },
      { id: "ideas", group: "Go to", label: "All Ideas", icon: <Library {...iconProps} />, run: go("/ideas"), keywords: "library search" },
      { id: "inbox", group: "Go to", label: "Inbox", hint: lib.inbox.length ? `${lib.inbox.length}` : undefined, icon: <Inbox {...iconProps} />, run: go("/inbox") },
      { id: "topics", group: "Go to", label: "Topics", icon: <Layers {...iconProps} />, run: go("/topics") },
      { id: "sources", group: "Go to", label: "Sources", icon: <BookOpen {...iconProps} />, run: go("/sources"), keywords: "books papers" },
      { id: "graph", group: "Go to", label: "Connections graph", hint: <span className="kbd">G</span>, icon: <Waypoints {...iconProps} />, run: go("/connections"), keywords: "graph network map" },
      { id: "explore", group: "Go to", label: "Explore", icon: <Compass {...iconProps} />, run: go("/explore"), keywords: "discover forgotten clusters contradictions" },
      { id: "settings", group: "Go to", label: "Settings", icon: <Settings {...iconProps} />, run: go("/settings") },
    ];

    const query = q.trim();
    if (!query) {
      const recent = [...lib.ideas]
        .sort((a, b) => (b.last_viewed_at ?? "").localeCompare(a.last_viewed_at ?? ""))
        .slice(0, 5)
        .map<Item>((i) => ({
          id: i.id,
          group: "Recently opened",
          label: <span className="font-serif">{displayTitle(i)}</span>,
          icon: <GrowthMark degree={lib.degree.get(i.id) ?? 0} />,
          run: go(`/ideas/${i.id}`),
        }));
      return [...actions.slice(0, 2), ...recent, ...actions.slice(2)];
    }

    const ideaHits = searchIdeas(
      lib.records.filter((r) => !r.idea.archived),
      query
    )
      .slice(0, 7)
      .map<Item>(({ idea }) => ({
        id: idea.id,
        group: "Ideas",
        label: <span className="font-serif">{displayTitle(idea)}</span>,
        hint: <span className="line-clamp-1 max-w-[16rem] text-xs text-faint">{previewText(idea, 80)}</span>,
        icon: <GrowthMark degree={lib.degree.get(idea.id) ?? 0} />,
        run: go(`/ideas/${idea.id}`),
      }));
    const nq = normalize(query);
    const topicHits = lib.data.topics
      .filter((t) => normalize(t.name).includes(nq))
      .slice(0, 3)
      .map<Item>((t) => ({ id: t.id, group: "Topics", label: t.name, hint: `${lib.ideasByTopic.get(t.id)?.length ?? 0}`, icon: <Layers size={15} strokeWidth={1.75} />, run: go(`/topics/${t.id}`) }));
    const sourceHits = lib.data.sources
      .filter((s) => normalize(s.title).includes(nq) || normalize(s.author ?? "").includes(nq))
      .slice(0, 3)
      .map<Item>((s) => ({ id: s.id, group: "Sources", label: <span className="font-serif italic">{s.title}</span>, hint: s.author ?? undefined, icon: <BookOpen size={15} strokeWidth={1.75} />, run: go(`/sources/${s.id}`) }));
    const projectHits = lib.data.projects
      .filter((p) => normalize(p.name).includes(nq))
      .slice(0, 3)
      .map<Item>((p) => ({ id: p.id, group: "Projects", label: p.name, icon: <span className="mx-[5px] h-1.5 w-1.5 rounded-full bg-faint" />, run: go(`/projects/${p.id}`) }));
    const actionHits = actions.filter((a) => normalize(`${typeof a.label === "string" ? a.label : ""} ${a.keywords ?? ""}`).includes(nq));
    const all: Item = {
      id: "search-all",
      group: "Search",
      label: (
        <span>
          Search all ideas for <span className="font-medium text-ink">“{query}”</span>
        </span>
      ),
      icon: <Search size={15} strokeWidth={1.75} />,
      run: go(`/ideas?q=${encodeURIComponent(query)}`),
    };
    const capture: Item = {
      id: "capture-q",
      group: "Search",
      label: (
        <span>
          Capture <span className="font-serif">“{query}”</span> as a new idea
        </span>
      ),
      icon: <Plus size={15} strokeWidth={1.75} />,
      run: () => ui.openCapture({ content: query }),
    };
    return [...ideaHits, ...topicHits, ...sourceHits, ...projectHits, ...actionHits, all, capture];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lib.records, lib.ideas, lib.data, lib.degree, lib.inbox.length]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!ui.palette.open) return null;

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div className="absolute inset-0 animate-fade bg-ink/20 dark:bg-black/50" onClick={ui.closePalette} />
      <div className="relative w-full max-w-xl animate-rise overflow-hidden rounded-lg border border-line bg-sheet shadow-[0_24px_64px_-24px_rgb(0_0_0/0.45)]">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} strokeWidth={1.75} className="text-faint" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                ui.closePalette();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                items[active]?.run();
              }
            }}
            placeholder="Search ideas, topics, sources, or type a command"
            className="h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-faint"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
          <span className="kbd hidden sm:inline-flex">esc</span>
        </div>
        <div ref={list} id="palette-list" role="listbox" className="max-h-[min(60vh,28rem)] overflow-y-auto py-1.5 scrollbar-thin">
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={`${it.group}-${it.id}`}>
                {header && <div className="px-4 pb-1 pt-2.5 text-xs text-faint">{header}</div>}
                <button
                  data-idx={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => it.run()}
                  className={cx("flex w-full items-center gap-3 px-4 py-2 text-left text-sm", i === active ? "bg-moss text-ink" : "text-stem")}
                >
                  <span className="flex w-4 shrink-0 justify-center text-stem">{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{it.label}</span>
                  {it.hint && <span className="hidden shrink-0 text-xs text-faint sm:block">{it.hint}</span>}
                  {i === active && <CornerDownLeft size={13} className="shrink-0 text-faint" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-faint sm:flex">
          <span>
            Try <span className="text-stem">#learning</span>, <span className="text-stem">author:kestrel</span> or <span className="text-stem">source:&quot;measurement&quot;</span>
          </span>
        </div>
      </div>
    </div>
  );
}
