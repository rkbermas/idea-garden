"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  CircleUser,
  Compass,
  House,
  Inbox,
  Layers,
  Library,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Shuffle,
  Waypoints,
  X,
} from "lucide-react";
import { useLibrary } from "./library";
import { useUI } from "./ui-state";
import { CaptureModal } from "./capture";
import { CommandPalette } from "./palette";
import { ConnectDialog } from "./connect-dialog";
import { cx } from "@/lib/text";
import { Logo } from "./logo";

export { Logo };

const NAV = [
  { href: "/", label: "Home", icon: House, key: null },
  { href: "/ideas", label: "All Ideas", icon: Library, key: null },
  { href: "/inbox", label: "Inbox", icon: Inbox, key: "inbox" },
  { href: "/topics", label: "Topics", icon: Layers, key: null },
  { href: "/sources", label: "Sources", icon: BookOpen, key: null },
  { href: "/connections", label: "Connections", icon: Waypoints, key: "G" },
  { href: "/explore", label: "Explore", icon: Compass, key: null },
  { href: "/random", label: "Random Idea", icon: Shuffle, key: "R" },
] as const;

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?(): void }) {
  const path = usePathname();
  const router = useRouter();
  const lib = useLibrary();
  const ui = useUI();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const projects = [...lib.data.projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const item = (href: string, label: string, Icon: typeof House, extra?: ReactNode) => {
    const active = isActive(path, href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={cx(
          "group flex h-8 items-center gap-2.5 rounded-md text-[0.875rem] transition-colors",
          collapsed ? "w-9 justify-center" : "px-2.5",
          active ? "bg-moss font-medium text-ink" : "text-stem hover:bg-sunk hover:text-ink"
        )}
      >
        <Icon size={16} strokeWidth={active ? 2 : 1.75} className={active ? "text-juniper" : ""} />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && extra}
      </Link>
    );
  };

  return (
    <nav className={cx("flex h-full flex-col", collapsed ? "items-center px-2" : "px-3")} aria-label="Main">
      <div className={cx("flex h-14 shrink-0 items-center", collapsed ? "justify-center" : "justify-between pl-1.5")}>
        {!collapsed && (
          <Link href="/" onClick={onNavigate} className="flex items-center gap-1.5 font-serif text-[1.0625rem] font-semibold tracking-[-0.01em] text-ink">
            <Logo className="h-5 w-5" />
            Idea Garden
          </Link>
        )}
        <button
          onClick={ui.toggleSidebar}
          className="btn-ghost hidden h-8 w-8 px-0 md:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.75} /> : <PanelLeftClose size={16} strokeWidth={1.75} />}
        </button>
      </div>

      <div className={cx("mb-4 mt-1 flex gap-1.5", collapsed ? "flex-col items-center" : "")}>
        <button
          onClick={() => {
            onNavigate?.();
            ui.openCapture();
          }}
          className={cx("btn-primary h-8", collapsed ? "w-9 px-0" : "flex-1 justify-start px-2.5")}
          title="New idea (N)"
        >
          <Plus size={16} strokeWidth={2} />
          {!collapsed && <span className="flex-1 text-left">New idea</span>}
          {!collapsed && <span className="text-xs text-paper/65">N</span>}
        </button>
        <button
          onClick={() => {
            onNavigate?.();
            ui.openPalette();
          }}
          className={cx("btn-quiet h-8", collapsed ? "w-9 px-0" : "w-9 px-0")}
          title="Search (⌘K)"
          aria-label="Search"
        >
          <Search size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="space-y-0.5">
        {NAV.map((n) =>
          item(
            n.href,
            n.label,
            n.icon,
            n.key === "inbox" && lib.inbox.length > 0 ? (
              <span className="text-xs tabular-nums text-faint">{lib.inbox.length}</span>
            ) : n.key ? (
              <span className="kbd opacity-0 transition-opacity group-hover:opacity-100">{n.key}</span>
            ) : null
          )
        )}
      </div>

      {!collapsed && (
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="mb-1 flex items-center justify-between pl-2.5 pr-1">
            <span className="text-xs font-medium text-faint">Projects</span>
            <button className="rounded p-1 text-faint hover:bg-sunk hover:text-ink" onClick={() => setAdding(true)} aria-label="New project" title="New project">
              <Plus size={13} strokeWidth={2} />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.map((p) => {
              const active = path === `/projects/${p.id}`;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={onNavigate}
                  className={cx(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[0.875rem] transition-colors",
                    active ? "bg-moss text-ink" : "text-stem hover:bg-sunk hover:text-ink"
                  )}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint/70" />
                  <span className="truncate">{p.name}</span>
                </Link>
              );
            })}
            {adding ? (
              <form
                className="px-1 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return setAdding(false);
                  const id = lib.createProject(name);
                  setName("");
                  setAdding(false);
                  onNavigate?.();
                  router.push(`/projects/${id}`);
                }}
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => !name.trim() && setAdding(false)}
                  onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                  placeholder="Project name"
                  className="field h-8 py-1 text-sm"
                />
              </form>
            ) : (
              !projects.length && (
                <button onClick={() => setAdding(true)} className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-faint hover:bg-sunk hover:text-stem">
                  Group ideas for an essay, talk or question
                </button>
              )
            )}
          </div>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      <div className={cx("space-y-0.5 border-t border-line py-3", collapsed ? "w-full flex flex-col items-center" : "")}>
        {item("/settings", "Settings", Settings)}
        {item("/account", "Account", CircleUser, lib.mode === "local" ? <span className="text-xs text-faint">Demo</span> : null)}
      </div>
    </nav>
  );
}

function useGlobalShortcuts() {
  const ui = useUI();
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        // Don't stack the palette over capture or connect dialogs.
        if (ui.capture.open || ui.connectFor) return;
        if (ui.palette.open) ui.closePalette();
        else ui.openPalette();
        return;
      }
      if (mod || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (ui.capture.open || ui.palette.open || ui.connectFor) return;
      switch (e.key) {
        case "n":
        case "N":
          e.preventDefault();
          ui.openCapture();
          break;
        case "/":
          e.preventDefault();
          ui.openPalette();
          break;
        case "g":
        case "G":
          e.preventDefault();
          router.push("/connections");
          break;
        case "r":
        case "R":
          e.preventDefault();
          router.push("/random");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui, router]);
}

function useThemeSync() {
  const { profile, status } = useLibrary();
  useEffect(() => {
    if (status !== "ready") return;
    const apply = () => {
      const dark = profile.theme === "dark" || (profile.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    try {
      localStorage.setItem("idea-garden:theme", profile.theme);
    } catch {
      /* ignore */
    }
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [profile.theme, status]);
}

function LoadingGarden() {
  return (
    <div className="mx-auto max-w-read px-5 pt-24 md:px-10" aria-busy="true" aria-label="Loading your garden">
      <div className="h-8 w-64 animate-pulse rounded bg-sunk" />
      <div className="mt-8 h-32 animate-pulse rounded-lg bg-sunk/70" />
      <div className="mt-12 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-5 w-3/5 animate-pulse rounded bg-sunk" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-sunk/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const lib = useLibrary();
  const ui = useUI();
  const path = usePathname();
  useGlobalShortcuts();
  useThemeSync();

  useEffect(() => {
    ui.setMobileNav(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const fullBleed = path === "/connections";

  return (
    <div className="min-h-dvh bg-paper">
      {/* Desktop sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-paper transition-[width] duration-200 md:block",
          ui.sidebarCollapsed ? "w-[3.75rem]" : "w-60"
        )}
      >
        <Sidebar collapsed={ui.sidebarCollapsed} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-[calc(3.25rem+env(safe-area-inset-top))] items-center gap-1 border-b border-line bg-paper/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <button className="btn-ghost h-10 w-10 px-0" onClick={() => ui.setMobileNav(true)} aria-label="Open navigation">
          <Menu size={19} strokeWidth={1.75} />
        </button>
        <Link href="/" className="flex flex-1 items-center gap-1.5 font-serif text-base font-semibold">
          <Logo className="h-5 w-5" /> Idea Garden
        </Link>
        <button className="btn-ghost h-10 w-10 px-0" onClick={() => ui.openPalette()} aria-label="Search">
          <Search size={18} strokeWidth={1.75} />
        </button>
      </header>

      {ui.mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade bg-ink/25 dark:bg-black/50" onClick={() => ui.setMobileNav(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-rise border-r border-line bg-paper pt-[env(safe-area-inset-top)]">
            <button className="btn-ghost absolute right-2 top-[calc(0.75rem+env(safe-area-inset-top))] h-8 w-8 px-0" onClick={() => ui.setMobileNav(false)} aria-label="Close navigation">
              <X size={17} />
            </button>
            <Sidebar collapsed={false} onNavigate={() => ui.setMobileNav(false)} />
          </div>
        </div>
      )}

      <main className={cx("transition-[padding] duration-200", ui.sidebarCollapsed ? "md:pl-[3.75rem]" : "md:pl-60")}>
        {lib.mode === "local" && lib.status === "ready" && !fullBleed && (
          <div className="border-b border-line bg-sunk/60 px-5 py-1.5 text-center text-xs text-stem">
            Demo mode: ideas are saved in this browser only. Add Supabase keys to sync and sign in.
          </div>
        )}
        {lib.status === "loading" && <LoadingGarden />}
        {lib.status === "error" && (
          <div className="mx-auto max-w-read px-5 pt-24 md:px-10">
            <h1 className="font-serif text-title">Your garden didn&apos;t load</h1>
            <p className="mt-2 text-stem">{lib.error}</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-primary" onClick={() => void lib.reload()}>
                Try again
              </button>
              <Link href="/login" className="btn-quiet">
                Sign in
              </Link>
            </div>
          </div>
        )}
        {lib.status === "ready" && children}
      </main>

      {/* Mobile quick capture */}
      {!ui.capture.open && !fullBleed && (
        <button
          onClick={() => ui.openCapture()}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-juniper text-paper shadow-[0_10px_24px_-8px_rgb(0_0_0/0.45)] active:scale-95 md:hidden"
          aria-label="New idea"
        >
          <Plus size={22} strokeWidth={2} />
        </button>
      )}

      {lib.status === "ready" && (
        <>
          <CaptureModal />
          <CommandPalette />
          <ConnectDialog />
        </>
      )}
    </div>
  );
}

/** Standard page column. */
export function Page({ children, width = "read", className }: { children: ReactNode; width?: "read" | "wide"; className?: string }) {
  return (
    <div className={cx("mx-auto px-5 pb-28 pt-8 sm:px-8 md:pt-14", width === "read" ? "max-w-read" : "max-w-wide", className)}>{children}</div>
  );
}
