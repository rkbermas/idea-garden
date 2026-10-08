"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show(message: string, opts?: { tone?: "info" | "error"; action?: Toast["action"] }): void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi["show"]>(
    (message, opts) => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts?.tone ?? "info", action: opts?.action }]);
      window.setTimeout(() => dismiss(id), opts?.tone === "error" ? 7000 : 3800);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={
              "pointer-events-auto flex max-w-md animate-rise items-center gap-4 rounded-md border px-4 py-2.5 text-sm shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)] " +
              (t.tone === "error" ? "border-rust/40 bg-sheet text-ink" : "border-line bg-ink text-paper")
            }
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                className="font-medium underline decoration-1 underline-offset-4 hover:no-underline"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
