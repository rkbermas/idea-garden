"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { HAS_SUPABASE } from "@/lib/env";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cx } from "@/lib/text";

type Mode = "signin" | "signup" | "magic" | "reset";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(
    params.get("error") ? { tone: "error", text: params.get("error")! } : null
  );

  useEffect(() => {
    document.title = "Sign in · Idea Garden";
  }, []);

  if (!HAS_SUPABASE) {
    return (
      <div>
        <h1 className="font-serif text-title font-medium">Demo mode</h1>
        <p className="mt-2 text-stem">
          No Supabase project is configured, so Idea Garden keeps your ideas in this browser. Add your Supabase keys to enable accounts.
        </p>
        <Link href="/" className="btn-primary mt-6">
          Open the garden
        </Link>
      </div>
    );
  }

  const callback = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callback, data: { display_name: name.trim() || undefined } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else setMsg({ tone: "ok", text: `Check ${email} for a link to confirm your account.` });
      } else if (mode === "magic") {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: callback } });
        if (error) throw error;
        setMsg({ tone: "ok", text: `Sign-in link sent to ${email}.` });
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/account` });
        if (error) throw error;
        setMsg({ tone: "ok", text: `If ${email} has an account, a reset link is on its way. Set a new password from Account.` });
      }
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const heading = { signin: "Welcome back", signup: "Start a garden", magic: "Sign in by email", reset: "Reset your password" }[mode];
  const action = { signin: "Sign in", signup: "Create account", magic: "Email me a link", reset: "Send reset link" }[mode];

  return (
    <div>
      <h1 className="font-serif text-title font-medium">{heading}</h1>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">
              Your first name
            </label>
            <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Used in your greeting" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        {(mode === "signin" || mode === "signup") && (
          <div>
            <div className="flex items-baseline justify-between">
              <label className="label" htmlFor="password">
                Password
              </label>
              {mode === "signin" && (
                <button type="button" className="text-xs text-stem hover:text-ink" onClick={() => setMode("reset")}>
                  Forgot it?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              required
              minLength={mode === "signup" ? 8 : undefined}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && <p className="mt-1 text-xs text-faint">At least 8 characters.</p>}
          </div>
        )}
        {msg && (
          <p role={msg.tone === "error" ? "alert" : "status"} className={cx("text-sm", msg.tone === "error" ? "text-rust" : "text-juniper")}>
            {msg.text}
          </p>
        )}
        <button className="btn-primary h-10 w-full" disabled={busy}>
          {busy ? "One moment…" : action}
        </button>
      </form>
      <div className="mt-6 space-y-1.5 text-sm text-stem">
        {mode !== "signin" && (
          <p>
            Have an account?{" "}
            <button className="text-ink underline decoration-line underline-offset-4 hover:decoration-juniper" onClick={() => setMode("signin")}>
              Sign in
            </button>
          </p>
        )}
        {mode !== "signup" && (
          <p>
            New here?{" "}
            <button className="text-ink underline decoration-line underline-offset-4 hover:decoration-juniper" onClick={() => setMode("signup")}>
              Create an account
            </button>
          </p>
        )}
        {mode !== "magic" && (
          <p>
            <button className="underline decoration-line underline-offset-4 hover:text-ink" onClick={() => setMode("magic")}>
              Sign in with an email link instead
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-paper lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-moss/70 p-12 lg:flex dark:bg-moss">
        <div className="flex items-center gap-2 font-serif text-lg font-semibold">
          <Logo className="h-6 w-6" /> Idea Garden
        </div>
        <figure className="max-w-md">
          <p className="text-sm text-stem">From a sample garden, 47 days ago</p>
          <p className="mt-3 font-serif text-[2rem] font-medium leading-[2.6rem] tracking-[-0.015em] text-ink">Familiarity is not understanding</p>
          <p className="mt-3 font-serif text-read text-stem">
            I can recognize an explanation when I see it again without being able to explain it myself.
          </p>
          <p className="mt-6 flex items-center gap-2 text-sm text-stem">
            <span className="inline-block h-px w-6 bg-line" /> connected to 3 other ideas
          </p>
        </figure>
        <p className="max-w-sm text-sm text-stem">A quiet place to keep the ideas you meet in books, talks and conversations, and to find them again.</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 font-serif text-lg font-semibold lg:hidden">
            <Logo className="h-6 w-6" /> Idea Garden
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
