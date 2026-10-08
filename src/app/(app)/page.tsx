"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { Page } from "@/components/app-shell";
import { CaptureForm } from "@/components/capture";
import { useLibrary } from "@/components/library";
import { useUI } from "@/components/ui-state";
import { Empty, IdeaRow, Section, SourceLine } from "@/components/idea-bits";
import { Markdown } from "@/components/markdown";
import { forgottenIdeas } from "@/lib/resurface";
import { displayTitle, greeting, relativeDays, relativeTime } from "@/lib/text";
import { relationshipLabel } from "@/lib/types";
import { useTitle } from "@/lib/use-title";

export default function HomePage() {
  useTitle(null);
  const lib = useLibrary();
  const ui = useUI();
  const name = (lib.profile.display_name ?? "").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const recent = lib.ideas.slice(0, 6);

  const pool = useMemo(() => forgottenIdeas(lib.ideas.filter((i) => i.status === "active"), 14).slice(0, 8), [lib.ideas]);
  const [pick, setPick] = useState(() => Math.floor(Math.random() * 8));
  const resurfaced = pool.length ? pool[pick % pool.length] : undefined;
  const resurfacedSource = resurfaced?.source_id ? lib.sourceById.get(resurfaced.source_id) : undefined;

  const recentLinks = useMemo(
    () =>
      [...lib.data.links]
        .filter((l) => lib.ideaById.has(l.source_idea_id) && lib.ideaById.has(l.target_idea_id))
        .filter((l) => !lib.ideaById.get(l.source_idea_id)!.archived && !lib.ideaById.get(l.target_idea_id)!.archived)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 4),
    [lib.data.links, lib.ideaById]
  );

  return (
    <Page>
      <header className="mb-7">
        <p className="text-sm text-faint">{today}</p>
        <h1 className="mt-1 font-serif text-display font-medium tracking-[-0.015em] text-ink">
          {greeting()}
          {name ? `, ${name}` : ""}.
        </h1>
      </header>

      <div className="rounded-lg border border-line bg-sheet shadow-[0_1px_0_rgb(0_0_0/0.02),0_12px_32px_-24px_rgb(0_0_0/0.25)] focus-within:border-juniper/40">
        <CaptureForm variant="inline" />
      </div>
      {lib.inbox.length > 0 && (
        <p className="mt-3 text-sm text-stem">
          <Link href="/inbox" className="underline decoration-line underline-offset-4 hover:decoration-juniper">
            {lib.inbox.length === 1 ? "1 idea is waiting" : `${lib.inbox.length} ideas are waiting`} in your Inbox
          </Link>{" "}
          for a source, tags or a connection.
        </p>
      )}

      <Section
        className="mt-14"
        title="Recently captured"
        action={
          recent.length > 0 && (
            <Link href="/ideas" className="text-sm text-stem hover:text-ink">
              All ideas
            </Link>
          )
        }
      >
        {recent.length ? (
          <div className="divide-y divide-line/70">
            {recent.map((i) => (
              <IdeaRow key={i.id} idea={i} />
            ))}
          </div>
        ) : (
          <Empty title="Nothing captured yet">Write the first idea above. One sentence in your own words is enough.</Empty>
        )}
      </Section>

      {resurfaced && (
        <Section title="Resurface">
          <div className="relative rounded-lg bg-moss/60 px-6 py-6 dark:bg-moss/70 sm:px-8">
            <p className="text-sm text-stem">You saved this {relativeDays(resurfaced.created_at)}</p>
            <Link href={`/ideas/${resurfaced.id}`} className="mt-2 block font-serif text-title font-medium text-ink text-pretty hover:text-juniper">
              {displayTitle(resurfaced)}
            </Link>
            {resurfaced.title && <Markdown text={resurfaced.content} className="mt-2 !text-[1.0625rem] !leading-7 text-stem" />}
            {resurfacedSource && <SourceLine source={resurfacedSource} className="mt-3 block" />}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/ideas/${resurfaced.id}`} className="btn-primary">
                Open idea
              </Link>
              <button className="btn-ghost" onClick={() => ui.openConnect(resurfaced.id)}>
                Connect
              </button>
              {pool.length > 1 && (
                <button className="btn-ghost" onClick={() => setPick((p) => p + 1)}>
                  <Shuffle size={14} strokeWidth={1.75} /> Another
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {recentLinks.length > 0 && (
        <Section
          title="Recently connected"
          action={
            <Link href="/connections" className="text-sm text-stem hover:text-ink">
              See the graph
            </Link>
          }
        >
          <ul className="space-y-1">
            {recentLinks.map((l) => {
              const a = lib.ideaById.get(l.source_idea_id)!;
              const b = lib.ideaById.get(l.target_idea_id)!;
              return (
                <li key={l.id} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 rounded-md py-2.5">
                  <p className="font-serif text-[1.0625rem] leading-7 text-pretty">
                    <Link href={`/ideas/${a.id}`} className="text-ink hover:text-juniper">
                      {displayTitle(a)}
                    </Link>{" "}
                    <span className={l.relationship_type === "contradicts" ? "font-sans text-sm text-rust" : "font-sans text-sm text-stem"}>
                      {relationshipLabel(l.relationship_type, true)}
                    </span>{" "}
                    <Link href={`/ideas/${b.id}`} className="text-ink hover:text-juniper">
                      {displayTitle(b)}
                    </Link>
                  </p>
                  <span className="text-xs text-faint">{relativeTime(l.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </Page>
  );
}
