"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Crosshair, Minus, Plus } from "lucide-react";
import { useLibrary } from "./library";
import { topicHue } from "@/lib/graph";
import { displayTitle } from "@/lib/text";
import type { RelationshipType } from "@/lib/types";

interface Node extends SimulationNodeDatum {
  id: string;
  label: string;
  r: number;
  degree: number;
  topicIndex: number | null;
  favorite: boolean;
  inbox: boolean;
}
interface Link extends SimulationLinkDatum<Node> {
  kind: "link" | "wiki";
  relationship: RelationshipType | null;
}

export interface GraphViewProps {
  /** Restrict to these ideas; defaults to every active idea. */
  nodeIds?: string[];
  className?: string;
  selectedId?: string | null;
  onSelect?(id: string | null): void;
  onOpen?(id: string): void;
  /** Ideas matching a search; others are dimmed. */
  highlight?: Set<string> | null;
  compact?: boolean;
  showOrphans?: boolean;
}

const positions = new Map<string, { x: number; y: number }>();

function cssColor(name: string, alpha = 1) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return `rgb(${v} / ${alpha})`;
}

export function GraphView({ nodeIds, className, selectedId, onSelect, onOpen, highlight, compact, showOrphans = true }: GraphViewProps) {
  const lib = useLibrary();
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Simulation<Node, Link> | null>(null);
  const view = useRef({ k: 1, x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });
  const hover = useRef<string | null>(null);
  const frame = useRef(0);
  const [hoverLabel, setHoverLabel] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState("grab");
  const fitted = useRef(false);
  /** Once the person pans or zooms, stop auto-fitting on resize. */
  const userMoved = useRef(false);

  const graph = useMemo(() => {
    const allowed = nodeIds ? new Set(nodeIds) : null;
    const ideas = lib.ideas.filter((i) => !allowed || allowed.has(i.id));
    const ids = new Set(ideas.map((i) => i.id));
    const links: Link[] = lib.edges
      .filter((e) => ids.has(e.a) && ids.has(e.b))
      .map((e) => ({ source: e.a, target: e.b, kind: e.kind, relationship: e.relationship }));
    const deg = new Map<string, number>();
    for (const l of links) {
      deg.set(l.source as string, (deg.get(l.source as string) ?? 0) + 1);
      deg.set(l.target as string, (deg.get(l.target as string) ?? 0) + 1);
    }
    const nodes: Node[] = ideas
      .filter((i) => showOrphans || (deg.get(i.id) ?? 0) > 0)
      .map((i) => {
        const d = deg.get(i.id) ?? 0;
        const topics = lib.topicsByIdea.get(i.id) ?? [];
        const p = positions.get(i.id);
        return {
          id: i.id,
          label: displayTitle(i),
          r: (compact ? 3 : 3.5) + Math.sqrt(d) * (compact ? 1.8 : 2.4),
          degree: d,
          topicIndex: topics.length ? lib.topicOrder.get(topics[0].id) ?? null : null,
          favorite: i.favorite,
          inbox: i.status === "inbox",
          x: p?.x ?? (Math.random() - 0.5) * 300,
          y: p?.y ?? (Math.random() - 0.5) * 300,
        };
      });
    const nodeSet = new Set(nodes.map((n) => n.id));
    const neighbors = new Map<string, Set<string>>();
    for (const l of links) {
      const a = l.source as string;
      const b = l.target as string;
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a)!.add(b);
      neighbors.get(b)!.add(a);
    }
    return { nodes, links: links.filter((l) => nodeSet.has(l.source as string) && nodeSet.has(l.target as string)), neighbors };
  }, [lib.ideas, lib.edges, lib.topicsByIdea, lib.topicOrder, nodeIds, compact, showOrphans]);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size.current;
    const { k, x: tx, y: ty } = view.current;
    const dark = document.documentElement.classList.contains("dark");
    const col = {
      line: cssColor("line"),
      edge: cssColor("faint", 0.45),
      edgeStrong: cssColor("juniper", 0.8),
      rust: cssColor("rust", 0.75),
      ink: cssColor("ink"),
      stem: cssColor("stem"),
      paper: cssColor("paper"),
      juniper: cssColor("juniper"),
      neutral: cssColor("stem", 0.75),
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(k, k);

    const focus = hover.current ?? selectedId ?? null;
    const near = focus ? graph.neighbors.get(focus) ?? new Set<string>() : null;
    const isLit = (id: string) => (focus ? id === focus || !!near?.has(id) : highlight ? highlight.has(id) : true);

    // Edges
    for (const l of graph.links) {
      const s = l.source as Node;
      const t = l.target as Node;
      if (s.x == null || t.x == null) continue;
      const lit = focus ? s.id === focus || t.id === focus : highlight ? highlight.has(s.id) && highlight.has(t.id) : true;
      ctx.globalAlpha = lit ? 1 : 0.12;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y!);
      ctx.lineTo(t.x, t.y!);
      ctx.lineWidth = (focus && lit ? 1.5 : l.kind === "wiki" ? 0.8 : 1.1) / Math.sqrt(k);
      if (l.relationship === "contradicts") {
        ctx.setLineDash([4 / k, 3 / k]);
        ctx.strokeStyle = col.rust;
      } else {
        ctx.setLineDash(l.kind === "wiki" ? [1.5 / k, 2.5 / k] : []);
        ctx.strokeStyle = focus && lit ? col.edgeStrong : col.edge;
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Nodes
    for (const n of graph.nodes) {
      if (n.x == null) continue;
      const lit = isLit(n.id);
      ctx.globalAlpha = lit ? 1 : 0.18;
      const fill = n.topicIndex != null ? topicHue(n.topicIndex, dark) : col.neutral;
      ctx.beginPath();
      ctx.arc(n.x, n.y!, n.r, 0, Math.PI * 2);
      if (n.inbox) {
        ctx.fillStyle = col.paper;
        ctx.fill();
        ctx.lineWidth = 1.4 / Math.sqrt(k);
        ctx.strokeStyle = fill;
        ctx.stroke();
      } else {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (n.favorite) {
        ctx.beginPath();
        ctx.arc(n.x, n.y!, n.r + 2.6, 0, Math.PI * 2);
        ctx.lineWidth = 1 / Math.sqrt(k);
        ctx.strokeStyle = col.juniper;
        ctx.stroke();
      }
      if (n.id === selectedId || (highlight && highlight.has(n.id) && !focus)) {
        ctx.beginPath();
        ctx.arc(n.x, n.y!, n.r + 4.5, 0, Math.PI * 2);
        ctx.lineWidth = 1.6 / Math.sqrt(k);
        ctx.strokeStyle = col.ink;
        ctx.stroke();
      }
    }

    // Labels (drawn at screen size)
    ctx.globalAlpha = 1;
    const fontSize = compact ? 11 : 12;
    ctx.font = `${fontSize / k}px "Instrument Sans Variable", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    // Place labels by priority and skip any that would collide with one already drawn.
    const placed: [number, number, number, number][] = [];
    const order = [...graph.nodes].sort((a, b) => (b.id === focus ? 1 : 0) - (a.id === focus ? 1 : 0) || b.degree - a.degree);
    for (const n of order) {
      if (n.x == null) continue;
      const lit = isLit(n.id);
      const important = n.degree >= (compact ? 2 : 3);
      const show = focus ? lit : highlight ? highlight.has(n.id) : k > 1.1 || (important && k > 0.6) || (compact && k > 0.8);
      if (!show) continue;
      const text = n.label.length > 42 ? n.label.slice(0, 40) + "…" : n.label;
      const y = n.y! + n.r + 4 / k;
      const tw = ctx.measureText(text).width;
      const box: [number, number, number, number] = [n.x - tw / 2 - 2 / k, y, n.x + tw / 2 + 2 / k, y + (fontSize + 2) / k];
      if (n.id !== focus && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      ctx.lineWidth = 3.5 / k;
      ctx.strokeStyle = col.paper;
      ctx.strokeText(text, n.x, y);
      ctx.fillStyle = n.id === focus ? col.ink : col.stem;
      ctx.fillText(text, n.x, y);
    }
    ctx.restore();
  }, [graph, selectedId, highlight, compact]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
  }, [draw]);

  const fit = useCallback(
    (animate = false) => {
      const ns = graph.nodes.filter((n) => n.x != null);
      const { w, h } = size.current;
      if (!ns.length || !w) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const n of ns) {
        minX = Math.min(minX, n.x! - n.r);
        maxX = Math.max(maxX, n.x! + n.r);
        minY = Math.min(minY, n.y! - n.r);
        maxY = Math.max(maxY, n.y! + n.r + 16);
      }
      const pad = compact ? 24 : 56;
      // Leave room for the floating controls panel on full-page graphs.
      const top = compact ? 24 : w < 640 ? 230 : 190;
      const k = Math.min(compact ? 1.4 : 1.5, Math.max(0.2, Math.min((w - pad * 2) / Math.max(maxX - minX, 1), (h - pad - top) / Math.max(maxY - minY, 1))));
      const target = { k, x: w / 2 - ((minX + maxX) / 2) * k, y: top + (h - pad - top) / 2 - ((minY + maxY) / 2) * k };
      if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        view.current = target;
        schedule();
        return;
      }
      const from = { ...view.current };
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / 320);
        const e = 1 - Math.pow(1 - p, 3);
        view.current = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
        draw();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [graph.nodes, compact, schedule, draw]
  );

  // Simulation
  useEffect(() => {
    const s = forceSimulation<Node, Link>(graph.nodes)
      .force(
        "link",
        forceLink<Node, Link>(graph.links)
          .id((d) => d.id)
          .distance((l) => (l.kind === "wiki" ? 70 : 58))
          .strength(0.55)
      )
      .force("charge", forceManyBody<Node>().strength(compact ? -90 : -150).distanceMax(420))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<Node>((d) => d.r + 6))
      .force("x", forceX<Node>(0).strength(0.045))
      .force("y", forceY<Node>(0).strength(0.045))
      .stop();
    // Settle most of the layout up front so the graph doesn't explode on screen.
    const fresh = graph.nodes.some((n) => !positions.has(n.id));
    s.tick(fresh ? 220 : 40);
    sim.current = s;
    if (!fitted.current || !userMoved.current) {
      fitted.current = true;
      fit(false);
    }
    s.alpha(0.05).alphaDecay(0.05).on("tick", () => {
      for (const n of graph.nodes) positions.set(n.id, { x: n.x!, y: n.y! });
      schedule();
    });
    s.restart();
    for (const n of graph.nodes) positions.set(n.id, { x: n.x!, y: n.y! });
    schedule();
    return () => {
      s.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  useEffect(() => {
    schedule();
  }, [selectedId, highlight, schedule]);

  // Resize & theme changes
  useEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (r.width < 2 || r.height < 2) return;
      const changed = Math.abs(r.width - size.current.w) > 1 || Math.abs(r.height - size.current.h) > 1;
      size.current = { w: r.width, h: r.height };
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      c.style.width = `${r.width}px`;
      c.style.height = `${r.height}px`;
      if (changed && !userMoved.current) fit(false);
      else schedule();
    });
    ro.observe(el);
    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [fit, schedule]);

  // Interaction
  const toWorld = (sx: number, sy: number) => {
    const { k, x, y } = view.current;
    return { x: (sx - x) / k, y: (sy - y) / k };
  };
  const nodeAt = (sx: number, sy: number): Node | null => {
    const p = toWorld(sx, sy);
    let best: Node | null = null;
    let bestD = Infinity;
    for (const n of graph.nodes) {
      const d = Math.hypot(n.x! - p.x, n.y! - p.y);
      const hit = n.r + 6 / view.current.k;
      if (d < hit && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ node: Node | null; startX: number; startY: number; moved: boolean; pinch?: { d: number; k: number; cx: number; cy: number } } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const zoomAt = (sx: number, sy: number, factor: number) => {
    userMoved.current = true;
    const { k, x, y } = view.current;
    const nk = Math.min(4, Math.max(0.2, k * factor));
    const f = nk / k;
    view.current = { k: nk, x: sx - (sx - x) * f, y: sy - (sy - y) * f };
    schedule();
  };

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(p.x, p.y, factor);
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  const onPointerDown = (e: React.PointerEvent) => {
    const p = local(e);
    canvas.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { node: null, startX: 0, startY: 0, moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.current.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 } };
      return;
    }
    const n = nodeAt(p.x, p.y);
    drag.current = { node: n, startX: p.x, startY: p.y, moved: false };
    if (n) {
      n.fx = n.x;
      n.fy = n.y;
    }
    setCursor(n ? "grabbing" : "grabbing");
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    const prev = pointers.current.get(e.pointerId);
    if (prev) pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (d?.pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const target = Math.min(4, Math.max(0.2, (d.pinch.k * dist) / d.pinch.d));
      zoomAt(d.pinch.cx, d.pinch.cy, target / view.current.k);
      return;
    }
    if (d && prev) {
      if (Math.hypot(p.x - d.startX, p.y - d.startY) > 3) d.moved = true;
      if (d.node) {
        const w = toWorld(p.x, p.y);
        d.node.fx = w.x;
        d.node.fy = w.y;
        sim.current?.alphaTarget(0.25).restart();
      } else if (d.moved) {
        userMoved.current = true;
        view.current = { ...view.current, x: view.current.x + (p.x - prev.x), y: view.current.y + (p.y - prev.y) };
        schedule();
      }
      return;
    }
    const n = nodeAt(p.x, p.y);
    const id = n?.id ?? null;
    if (id !== hover.current) {
      hover.current = id;
      setCursor(n ? "pointer" : "grab");
      setHoverLabel(n ? { id: n.id, x: p.x, y: p.y } : null);
      schedule();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d?.pinch) {
      if (pointers.current.size === 0) drag.current = null;
      return;
    }
    drag.current = null;
    setCursor(hover.current ? "pointer" : "grab");
    if (!d) return;
    if (d.node) {
      d.node.fx = null;
      d.node.fy = null;
      sim.current?.alphaTarget(0);
    }
    if (!d.moved) {
      onSelect?.(d.node?.id ?? null);
    }
  };

  const hovered = hoverLabel ? lib.ideaById.get(hoverLabel.id) : undefined;

  return (
    <div ref={wrap} className={"overflow-hidden " + (className?.includes("absolute") ? className : `relative ${className ?? ""}`)}>
      <canvas
        ref={canvas}
        className="absolute inset-0 block"
        role="img"
        aria-label={`Graph of ${graph.nodes.length} ideas and ${graph.links.length} connections`}
        style={{ cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (!drag.current && hover.current) {
            hover.current = null;
            setHoverLabel(null);
            schedule();
          }
        }}
        onDoubleClick={(e) => {
          const p = local(e);
          const n = nodeAt(p.x, p.y);
          if (n) onOpen?.(n.id);
          else zoomAt(p.x, p.y, 1.6);
        }}
      />
      {hovered && !compact && (
        <div
          className="pointer-events-none absolute z-10 max-w-[16rem] rounded-md border border-line bg-sheet/95 px-3 py-2 text-sm shadow-[0_8px_24px_-12px_rgb(0_0_0/0.3)] backdrop-blur"
          style={{ left: Math.min(hoverLabel!.x + 14, size.current.w - 270), top: hoverLabel!.y + 14 }}
        >
          <p className="font-serif leading-snug text-ink">{displayTitle(hovered)}</p>
          <p className="mt-0.5 text-xs text-stem">
            {graph.neighbors.get(hovered.id)?.size ?? 0} connections. Click to preview, double-click to open.
          </p>
        </div>
      )}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-md border border-line bg-sheet/90 backdrop-blur">
        <button className="p-2 text-stem hover:bg-sunk hover:text-ink" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1.3)} aria-label="Zoom in">
          <Plus size={14} />
        </button>
        <button className="border-t border-line p-2 text-stem hover:bg-sunk hover:text-ink" onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1 / 1.3)} aria-label="Zoom out">
          <Minus size={14} />
        </button>
        <button className="border-t border-line p-2 text-stem hover:bg-sunk hover:text-ink" onClick={() => { userMoved.current = false; fit(true); }} aria-label="Fit graph to view">
          <Crosshair size={14} />
        </button>
      </div>
    </div>
  );
}
