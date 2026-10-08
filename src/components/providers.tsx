"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./toast";
import { LibraryProvider } from "./library";
import { UIProvider } from "./ui-state";
import { AppShell } from "./app-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <LibraryProvider>
        <UIProvider>
          <AppShell>{children}</AppShell>
        </UIProvider>
      </LibraryProvider>
    </ToastProvider>
  );
}
