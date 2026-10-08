"use client";

import Link from "next/link";
import { useLibrary } from "./library";
import { renderInline } from "./markdown";
import { displayTitle } from "@/lib/text";

/**
 * AI replies cite ideas as {{id}}. Each citation becomes a numbered link to the
 * real idea; ids that aren't in the library are dropped, so nothing invented
 * can masquerade as a saved idea.
 */
export function AIAnswer({ text }: { text: string }) {
  const lib = useLibrary();
  const order: string[] = [];
  const num = (id: string) => {
    let i = order.indexOf(id);
    if (i === -1) {
      order.push(id);
      i = order.length - 1;
    }
    return i + 1;
  };

  const paragraphs = text.trim().split(/\n{2,}/);
  const rendered = paragraphs.map((p, pi) => {
    const parts = p.split(/(\{\{[0-9a-f-]{8,}\}\})/gi);
    return (
      <p key={pi} className={pi ? "mt-3" : ""}>
        {parts.map((part, i) => {
          const m = part.match(/^\{\{([0-9a-f-]+)\}\}$/i);
          if (!m) {
            const lines = part.split("\n");
            return lines.map((l, li) => (
              <span key={`${i}-${li}`}>
                {li > 0 && <br />}
                {renderInline(l.replace(/^\s*[-*]\s+/, "• "), `a${pi}-${i}-${li}`)}
              </span>
            ));
          }
          const idea = lib.ideaById.get(m[1]);
          if (!idea) return null;
          return (
            <Link key={i} href={`/ideas/${idea.id}`} title={displayTitle(idea)} className="mx-0.5 align-super text-[0.7em] font-sans font-medium text-juniper hover:underline">
              {num(idea.id)}
            </Link>
          );
        })}
      </p>
    );
  });

  return (
    <div>
      <div className="font-serif text-[1.0625rem] leading-7 text-ink">{rendered}</div>
      {order.length > 0 && (
        <ol className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          {order.map((id, i) => (
            <li key={id} className="flex gap-2">
              <span className="w-4 shrink-0 text-right tabular-nums text-faint">{i + 1}</span>
              <Link href={`/ideas/${id}`} className="font-serif text-ink hover:text-juniper">
                {displayTitle(lib.ideaById.get(id)!)}
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-faint">Written by AI from your saved ideas. Numbers link to the ideas it drew on.</p>
    </div>
  );
}
