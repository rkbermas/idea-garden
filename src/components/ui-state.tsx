"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CapturePrefill {
  title?: string;
  content?: string;
  sourceId?: string;
  topicIds?: string[];
  projectIds?: string[];
  tags?: string[];
  /** Idea to connect the new one to after saving. */
  connectTo?: string;
}

interface UIValue {
  capture: { open: boolean; prefill: CapturePrefill | null };
  openCapture(prefill?: CapturePrefill): void;
  closeCapture(): void;
  palette: { open: boolean; query: string };
  openPalette(query?: string): void;
  closePalette(): void;
  connectFor: string | null;
  openConnect(ideaId: string): void;
  closeConnect(): void;
  sidebarCollapsed: boolean;
  toggleSidebar(): void;
  mobileNav: boolean;
  setMobileNav(v: boolean): void;
  ai: { enabled: boolean; checked: boolean };
}

const Ctx = createContext<UIValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [capture, setCapture] = useState<UIValue["capture"]>({ open: false, prefill: null });
  const [palette, setPalette] = useState({ open: false, query: "" });
  const [connectFor, setConnectFor] = useState<string | null>(null);
  const [sidebarCollapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [ai, setAi] = useState({ enabled: false, checked: false });

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("idea-garden:sidebar") === "collapsed");
    } catch {
      /* ignore */
    }
    fetch("/api/ai")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => setAi({ enabled: !!j.enabled, checked: true }))
      .catch(() => setAi({ enabled: false, checked: true }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("idea-garden:sidebar", c ? "open" : "collapsed");
      } catch {
        /* ignore */
      }
      return !c;
    });
  }, []);

  const value = useMemo<UIValue>(
    () => ({
      capture,
      openCapture: (prefill) => {
        setPalette({ open: false, query: "" });
        setCapture({ open: true, prefill: prefill ?? null });
      },
      closeCapture: () => setCapture({ open: false, prefill: null }),
      palette,
      openPalette: (query = "") => setPalette({ open: true, query }),
      closePalette: () => setPalette({ open: false, query: "" }),
      connectFor,
      openConnect: (id) => setConnectFor(id),
      closeConnect: () => setConnectFor(null),
      sidebarCollapsed,
      toggleSidebar,
      mobileNav,
      setMobileNav,
      ai,
    }),
    [capture, palette, connectFor, sidebarCollapsed, toggleSidebar, mobileNav, ai]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
