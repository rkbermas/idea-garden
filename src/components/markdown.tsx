"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useLibrary } from "./library";
import { useUI } from "./ui-state";
import { cx } from "@/lib/text";

function WikiLink({ target, alias }: { target: string; alias: string | null }) {
  const { resolveWiki } = useLibrary();
  const { openCapture } = useUI();
  const idea = resolveWiki(target);
  const label = alias ?? target;
  if (idea) {
    return (
      <Link href={`/ideas/${idea.id}`} className="wikilink">
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="wikilink-missing"
      title={`No idea called “${target}” yet. Click to capture it.`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openCapture({ title: target });
      }}
    >
      {label}
    </button>
  );
}

const INLINE =
  /(\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\])|(\*\*([^*]+?)\*\*)|(__([^_]+?)__)|(\*([^*\s][^*]*?)\*)|(_([^_\s][^_]*?)_)|(`([^`]+?)`)|(==([^=]+?)==)|(\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))|(https?:\/\/[^\s)<]+[^\s)<.,;:!?])/g;

export function renderInline(text: string, key = "i", links = true): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(links ? <WikiLink key={k} target={m[2].trim()} alias={m[3]?.trim() ?? null} /> : <span key={k}>{m[3] ?? m[2]}</span>);
    else if (m[4]) out.push(<strong key={k} className="font-semibold">{renderInline(m[5], k, links)}</strong>);
    else if (m[6]) out.push(<strong key={k} className="font-semibold">{renderInline(m[7], k, links)}</strong>);
    else if (m[8]) out.push(<em key={k}>{renderInline(m[9], k, links)}</em>);
    else if (m[10]) out.push(<em key={k}>{renderInline(m[11], k, links)}</em>);
    else if (m[12]) out.push(<code key={k}>{m[13]}</code>);
    else if (m[14]) out.push(<mark key={k}>{renderInline(m[15], k, links)}</mark>);
    else if (m[16])
      out.push(
        links ? (
          <a key={k} href={m[18]} target="_blank" rel="noreferrer noopener" className="ext">
            {m[17]}
          </a>
        ) : (
          <span key={k}>{m[17]}</span>
        )
      );
    else if (m[19])
      out.push(
        links ? (
          <a key={k} href={m[19]} target="_blank" rel="noreferrer noopener" className="ext break-all">
            {m[19].replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span key={k}>{m[19]}</span>
        )
      );
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "h"; level: number; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "hr" };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let cur = null as Block | null;
  const flush = () => {
    if (cur) blocks.push(cur);
    cur = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flush();
      blocks.push({ type: "h", level: m[1].length, text: m[2] });
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ type: "hr" });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      if (cur?.type !== "quote") {
        flush();
        cur = { type: "quote", lines: [] };
      }
      (cur as Extract<Block, { type: "quote" }>).lines.push(m[1]);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
      if (!cur || cur.type !== "ul") {
        flush();
        cur = { type: "ul", items: [] };
      }
      (cur as { items: string[] }).items.push(m[1]);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!cur || cur.type !== "ol") {
        flush();
        cur = { type: "ol", items: [] };
      }
      (cur as { items: string[] }).items.push(m[1]);
    } else {
      if (cur?.type !== "p") {
        flush();
        cur = { type: "p", lines: [] };
      }
      (cur as Extract<Block, { type: "p" }>).lines.push(line);
    }
  }
  flush();
  return blocks;
}

function withBreaks(lines: string[], key: string) {
  return lines.map((l, i) => (
    <Fragment key={`${key}-${i}`}>
      {i > 0 && <br />}
      {renderInline(l, `${key}-${i}`)}
    </Fragment>
  ));
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={cx("prose-idea", className)}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.type) {
          case "p":
            return <p key={k}>{withBreaks(b.lines, k)}</p>;
          case "h":
            return b.level === 1 ? (
              <h2 key={k} className="text-lead">{renderInline(b.text, k)}</h2>
            ) : (
              <h3 key={k} className="text-read">{renderInline(b.text, k)}</h3>
            );
          case "quote":
            return <blockquote key={k}>{withBreaks(b.lines, k)}</blockquote>;
          case "ul":
            return (
              <ul key={k}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${k}-${j}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={k}>
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it, `${k}-${j}`)}</li>
                ))}
              </ol>
            );
          case "hr":
            return <hr key={k} className="my-6 border-line" />;
        }
      })}
    </div>
  );
}
