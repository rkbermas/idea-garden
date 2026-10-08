"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cx } from "@/lib/text";

export interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function FilterMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  searchable,
  align = "left",
}: {
  label: string;
  value: T | "";
  options: Option<T>[];
  onChange(v: T | ""): void;
  searchable?: boolean;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = options.filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        aria-expanded={open}
        className={cx(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
          current ? "border-juniper/40 bg-moss text-ink" : "border-line text-stem hover:border-faint/60 hover:text-ink"
        )}
      >
        {current ? current.label : label}
        <ChevronDown size={13} strokeWidth={2} className="opacity-60" />
      </button>
      {open && (
        <div
          className={cx(
            "absolute z-30 mt-1.5 w-56 animate-sprout overflow-hidden rounded-md border border-line bg-sheet py-1 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.3)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {searchable && (
            <div className="border-b border-line px-2 pb-1.5 pt-0.5">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find ${label.toLowerCase()}`} className="field h-8 py-1 text-sm" />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {value && (
              <button
                className="block w-full px-3 py-1.5 text-left text-sm text-stem hover:bg-sunk"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Any {label.toLowerCase()}
              </button>
            )}
            {shown.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-sunk"
              >
                <span className="w-3.5">{o.value === value && <Check size={13} className="text-juniper" />}</span>
                <span className="flex-1 truncate">{o.label}</span>
                {o.count !== undefined && <span className="text-xs tabular-nums text-faint">{o.count}</span>}
              </button>
            ))}
            {!shown.length && <p className="px-3 py-2 text-sm text-faint">Nothing matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
