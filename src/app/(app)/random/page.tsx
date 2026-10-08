"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Network, Shuffle } from "lucide-react";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { useToast } from "@/components/toast";
import { Markdown } from "@/components/markdown";
import { Empty, GrowthMark, SourceLine, TagList } from "@/components/idea-bits";
import { resurfaceQueue } from "@/lib/resurface";
import { similarityLabel } from "@/lib/similarity";
import { cx, displayTitle, formatDate, relativeDays } from "@/lib/text";
import { relationshipLabel } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

export default function RandomPage() {
  useTitle("Random Idea");
  const lib = useLibrary();
  const ui = useUI();
  const toast = useToast();
  const active = useMemo(() => lib.ideas.filter((i) => i.status === "active"), [lib.ideas]);
  // Build the order once per visit so marking ideas as viewed doesn't reshuffle it.
  const [queue] = useState(() => resurfaceQueue(active));
  const [index, setIndex] = useState(0);
  const [reflection, setReflection] = useState("");
  const [showRelated, setShowRelated] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [seen, setSeen] = useState(1);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const ids = queue.filter((id) => lib.ideaById.get(id) && !lib.ideaById.get(id)!.archived);
  const id = ids.length ? ids[index % ids.length] : undefined;
  const idea = id ? lib.ideaById.get(id) : undefined;
  // What the person last saw, captured before this visit marks it viewed.
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    if (!idea) return;
    setLastSeenAt(idea.last_viewed_at);
    lib.markViewed(idea.id);
    setReflection("");
    setShowRelated(false);
    setShowPast(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const next = () => {
    if (reflection.trim() && idea) {
      lib.addReflection(idea.id, reflection);
      toast.show("Reflection saved.");
    }
    setIndex((i) => i + 1);
    setSeen((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(t.tagName) || ui.capture.open || ui.palette.open || ui.connectFor) return;
      if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        next();
      } else if (e.key === "w") {
        e.preventDefault();
        textarea.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!idea) {
    return (
      <div className="mx-auto max-w-read px-5 pt-16 sm:px-8">
        <Empty title="Nothing to resurface yet">Once you&apos;ve kept a few ideas, this is where they come back to you.</Empty>
      </div>
    );
  }

  const source = idea.source_id ? lib.sourceById.get(idea.source_id) : undefined;
  const connections = lib.connections.get(idea.id) ?? [];
  const connectedSet = new Set(connections.map((c) => c.otherId));
  const similar = lib.similarity.similar(idea.id, 4, connectedSet);
  const reflections = lib.reflectionsByIdea.get(idea.id) ?? [];
  const hasPast = !!idea.personal_thoughts || reflections.length > 0;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3.25rem)] max-w-read flex-col px-5 pb-28 pt-10 sm:px-8 md:min-h-dvh md:pt-[12vh]">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-stem">
          From your notes, {relativeDays(idea.created_at)}
          {lastSeenAt && relativeDays(lastSeenAt) !== relativeDays(idea.created_at) && (
            <span className="text-faint">. Last opened {relativeDays(lastSeenAt)}</span>
          )}
        </p>
        <span className="text-xs tabular-nums text-faint">{seen} this session</span>
      </div>

      <article key={idea.id} className="mt-5 animate-rise">
        <Link href={`/ideas/${idea.id}`} className="font-serif text-display font-medium leading-[2.75rem] tracking-[-0.015em] text-ink text-pretty hover:text-juniper">
          {displayTitle(idea)}
        </Link>
        {idea.title && <Markdown text={idea.content} className="mt-4 text-lead leading-[2.05rem]" />}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SourceLine source={source} location={idea.source_location} />
          <TagList ideaId={idea.id} />
        </div>

        {hasPast && (
          <div className="mt-6">
            <button className="text-sm text-stem underline decoration-line underline-offset-4 hover:text-ink" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
              {showPast ? "Hide what I thought before" : "What I thought before"}
            </button>
            {showPast && (
              <div className="mt-3 animate-fade space-y-3 border-l-2 border-line pl-4">
                {idea.personal_thoughts && <Markdown text={idea.personal_thoughts} className="!text-base !leading-7 text-stem" />}
                {reflections.map((r) => (
                  <div key={r.id}>
                    <p className="text-xs text-faint">{formatDate(r.created_at, { year: true })}</p>
                    <Markdown text={r.content} className="!text-base !leading-7 text-stem" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </article>

      <div className="mt-12">
        <label htmlFor="reflection" className="font-serif text-read text-ink">
          What does this make you think of now?
        </label>
        <textarea
          id="reflection"
          ref={textarea}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && reflection.trim()) {
              e.preventDefault();
              lib.addReflection(idea.id, reflection);
              setReflection("");
              toast.show("Reflection saved.");
            }
          }}
          rows={3}
          placeholder="A new example, a disagreement, somewhere it applies…"
          className="field mt-2 font-serif text-[1.0625rem] leading-7"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          className="btn-quiet"
          disabled={!reflection.trim()}
          onClick={() => {
            lib.addReflection(idea.id, reflection);
            setReflection("");
            toast.show("Reflection saved.");
          }}
        >
          Add reflection
        </button>
        <button className={cx("btn-ghost", showRelated && "bg-sunk text-ink")} onClick={() => setShowRelated((v) => !v)} aria-expanded={showRelated}>
          <Network size={15} strokeWidth={1.75} /> Related
        </button>
        <button className="btn-ghost" onClick={() => ui.openConnect(idea.id)}>
          <Link2 size={15} strokeWidth={1.75} /> Connect
        </button>
        <button className="btn-primary ml-auto" onClick={next}>
          <Shuffle size={15} strokeWidth={1.75} /> Next idea
        </button>
      </div>
      <p className="mt-3 hidden text-right text-xs text-faint sm:block">
        <span className="kbd">→</span> next. A reflection you&apos;ve typed is saved when you move on.
      </p>

      {showRelated && (
        <div className="mt-8 animate-fade space-y-6">
          {connections.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-stem">Already connected</p>
              <ul className="space-y-1.5">
                {connections.map((c) => (
                  <li key={`${c.kind}-${c.linkId ?? c.otherId}`} className="flex items-baseline gap-2">
                    <span className={cx("shrink-0 text-xs", c.relationship === "contradicts" ? "text-rust" : "text-faint")}>
                      {c.kind === "wiki" ? (c.outgoing ? "mentions" : "mentioned by") : relationshipLabel(c.relationship, c.outgoing)}
                    </span>
                    <Link href={`/ideas/${c.otherId}`} className="font-serif text-ink hover:text-juniper">
                      {displayTitle(lib.ideaById.get(c.otherId)!)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-sm text-stem">Might connect to</p>
            {similar.length ? (
              <ul className="space-y-2">
                {similar.map((s) => (
                  <li key={s.id} className="flex items-center gap-3">
                    <GrowthMark degree={lib.degree.get(s.id) ?? 0} />
                    <Link href={`/ideas/${s.id}`} className="flex-1 font-serif text-ink hover:text-juniper">
                      {displayTitle(lib.ideaById.get(s.id)!)}
                    </Link>
                    <span className="text-xs text-faint">{similarityLabel(s.score)}</span>
                    <button className="btn-quiet h-7 px-2.5 text-xs" onClick={() => { lib.connect(idea.id, s.id, null); toast.show("Connected."); }}>
                      Connect
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-faint">Nothing obviously similar. That can be interesting too.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
