"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { useLibrary } from "./library";
import { cx, displayTitle, formatDate, previewText, relativeDays } from "@/lib/text";
import { highlightRuns } from "@/lib/search";
import type { Idea, Source } from "@/lib/types";

/** Growth stage of an idea: how far it has been connected into the garden. */
export function growthStage(degree: number) {
  if (degree === 0) return { leaves: 0, label: "Seed: not connected yet" };
  if (degree <= 2) return { leaves: 1, label: `Sprout: ${degree} connection${degree > 1 ? "s" : ""}` };
  if (degree <= 4) return { leaves: 2, label: `Growing: ${degree} connections` };
  return { leaves: 3, label: `Flourishing: ${degree} connections` };
}

export function GrowthMark({ degree, className }: { degree: number; className?: string }) {
  const { leaves, label } = growthStage(degree);
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className={cx("shrink-0 text-juniper", className)} role="img" aria-label={label}>
      <title>{label}</title>
      {leaves === 0 ? (
        <ellipse cx="8" cy="10.5" rx="2.4" ry="3" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.7" />
      ) : (
        <>
          <path d="M8 15V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M8 10.5C5.2 10.5 3.6 9 3.6 6.4 6.3 6.4 8 7.8 8 10.5Z" fill="currentColor" />
          {leaves >= 2 && <path d="M8 8.2C8 5.6 9.6 4 12.4 4 12.4 6.7 10.8 8.2 8 8.2Z" fill="currentColor" opacity="0.8" />}
          {leaves >= 3 && <circle cx="8" cy="3.4" r="1.9" fill="currentColor" opacity="0.6" />}
        </>
      )}
    </svg>
  );
}

export function SourceLine({ source, location, className, link = true }: { source?: Source; location?: string | null; className?: string; link?: boolean }) {
  if (!source) return null;
  const inner = (
    <>
      <span className="font-serif italic">{source.title}</span>
      {source.author && <span className="text-stem">, {source.author}</span>}
      {location && <span className="text-faint">, {location}</span>}
    </>
  );
  return link ? (
    <Link href={`/sources/${source.id}`} className={cx("text-sm text-stem transition-colors hover:text-ink", className)} onClick={(e) => e.stopPropagation()}>
      {inner}
    </Link>
  ) : (
    <span className={cx("text-sm text-stem", className)}>{inner}</span>
  );
}

export function TagList({ ideaId, max = 4, className }: { ideaId: string; max?: number; className?: string }) {
  const { tagsByIdea } = useLibrary();
  const tags = tagsByIdea.get(ideaId) ?? [];
  if (!tags.length) return null;
  return (
    <span className={cx("inline-flex flex-wrap gap-1", className)}>
      {tags.slice(0, max).map((t) => (
        <Link key={t.id} href={`/ideas?tag=${encodeURIComponent(t.name)}`} className="chip" onClick={(e) => e.stopPropagation()}>
          {t.name}
        </Link>
      ))}
      {tags.length > max && <span className="chip bg-transparent">+{tags.length - max}</span>}
    </span>
  );
}

function Highlighted({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <>{text}</>;
  return (
    <>
      {highlightRuns(text, terms).map((r, i) =>
        r.hit ? (
          <mark key={i} className="rounded-sm bg-bloom px-px text-ink">
            {r.text}
          </mark>
        ) : (
          <span key={i}>{r.text}</span>
        )
      )}
    </>
  );
}

export function IdeaRow({
  idea,
  terms,
  snippet,
  aside,
  showDate = true,
  dense,
}: {
  idea: Idea;
  terms?: string[];
  snippet?: string;
  aside?: ReactNode;
  showDate?: boolean;
  dense?: boolean;
}) {
  const { sourceById, degree, tagsByIdea } = useLibrary();
  const source = idea.source_id ? sourceById.get(idea.source_id) : undefined;
  const preview = snippet ?? previewText(idea);
  const hasMeta = !!source || !!aside || (!dense && (tagsByIdea.get(idea.id) ?? []).length > 0);
  return (
    <article
      className={cx(
        "group relative -mx-3 rounded-md px-3 transition-colors hover:bg-sheet has-[a.stretch:focus-visible]:ring-2 has-[a.stretch:focus-visible]:ring-juniper/50",
        dense ? "py-2.5" : "py-4"
      )}
    >
      <div className="flex items-start gap-2.5">
        <GrowthMark degree={degree.get(idea.id) ?? 0} className="mt-[0.4rem]" />
        <div className="min-w-0 flex-1">
          <h3 className={cx("font-serif font-medium text-ink text-pretty", dense ? "text-[1.0625rem] leading-7" : "text-read leading-7")}>
            <Link href={`/ideas/${idea.id}`} className="stretch after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              <Highlighted text={displayTitle(idea)} terms={terms} />
            </Link>
            {idea.favorite && <Star size={13} className="ml-1.5 inline -translate-y-px fill-juniper/70 text-juniper/70" aria-label="Favorite" />}
          </h3>
          {preview && !dense && (
            <p className="mt-1 line-clamp-2 font-serif text-[1.0625rem] leading-7 text-stem">
              <Highlighted text={preview} terms={terms} />
            </p>
          )}
          {hasMeta && (
            <div className={cx("relative z-10 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1.5", dense ? "mt-0.5" : "mt-2")}>
              <SourceLine source={source} location={dense ? null : idea.source_location} />
              {!dense && <TagList ideaId={idea.id} />}
              {aside}
            </div>
          )}
        </div>
        {showDate && (
          <time dateTime={idea.created_at} className="mt-1 shrink-0 text-xs text-faint" title={new Date(idea.created_at).toLocaleString()}>
            {formatDate(idea.created_at)}
          </time>
        )}
      </div>
    </article>
  );
}

export function IdeaLinkInline({ idea, className }: { idea: Idea; className?: string }) {
  return (
    <Link href={`/ideas/${idea.id}`} className={cx("font-serif text-ink decoration-line underline-offset-4 hover:underline", className)}>
      {displayTitle(idea)}
    </Link>
  );
}

export function SavedAgo({ iso }: { iso: string }) {
  return <span>You saved this {relativeDays(iso)}</span>;
}

export function PageHeader({ title, children, description }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-display font-medium tracking-[-0.01em] text-ink text-balance">{title}</h1>
        {description && <p className="mt-1.5 max-w-[30rem] text-stem">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-serif text-read text-ink">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-sm text-stem">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Section({ title, children, action, className }: { title: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cx("mt-14 first:mt-0", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
