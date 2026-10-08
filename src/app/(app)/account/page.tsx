"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { PageHeader } from "@/components/idea-bits";
import { resetLocalDemo } from "@/lib/repo";
import { supabaseBrowser } from "@/lib/supabase/client";
import { plural } from "@/lib/text";
import { useTitle } from "@/lib/use-title";

export default function AccountPage() {
  useTitle("Account");
  const lib = useLibrary();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const stats = [
    plural(lib.ideas.length, "idea"),
    plural(lib.data.sources.length, "source"),
    plural(lib.edges.length, "connection"),
    plural(lib.data.reflections.length, "reflection"),
  ];

  if (lib.mode === "local") {
    return (
      <Page>
        <PageHeader title="Account" description="You're using Idea Garden in demo mode." />
        <div className="space-y-4 text-stem">
          <p>
            Everything you capture is stored in this browser only: {stats.join(", ")}. Clearing your browser data, or opening the app on another device,
            starts a fresh garden.
          </p>
          <p>
            To sign in and sync, create a Supabase project, run the migration in <code className="rounded bg-sunk px-1 text-sm">supabase/migrations</code>, and set{" "}
            <code className="rounded bg-sunk px-1 text-sm">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="rounded bg-sunk px-1 text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. The README walks through it.
          </p>
        </div>
        <div className="mt-8 border-t border-line pt-6">
          <button
            className="btn-danger border border-rust/30"
            onClick={() => {
              if (!window.confirm("Erase the demo garden in this browser and start again with the sample ideas?")) return;
              resetLocalDemo();
              window.location.href = "/";
            }}
          >
            Reset demo garden
          </button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Account" />
      <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
        <dt className="text-stem">Signed in as</dt>
        <dd className="text-ink">{lib.email}</dd>
        <dt className="text-stem">Your garden</dt>
        <dd className="text-ink">{stats.join(", ")}</dd>
        <dt className="text-stem">Privacy</dt>
        <dd className="text-ink">Only you can read your ideas. Every table is protected by row-level security tied to your account.</dd>
      </dl>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="font-medium">Change password</h2>
        <form
          className="mt-3 flex max-w-sm gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.length < 8) return setMsg({ tone: "error", text: "Use at least 8 characters." });
            const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
            setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: "Password updated." });
            if (!error) setPw("");
          }}
        >
          <input type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" autoComplete="new-password" aria-label="New password" />
          <button className="btn-quiet" disabled={!pw}>
            Update
          </button>
        </form>
        {msg && <p className={msg.tone === "error" ? "mt-2 text-sm text-rust" : "mt-2 text-sm text-juniper"}>{msg.text}</p>}
      </section>

      <section className="mt-10 border-t border-line pt-6">
        <button className="btn-quiet" onClick={() => void lib.signOut()}>
          <LogOut size={15} strokeWidth={1.75} /> Sign out
        </button>
      </section>
    </Page>
  );
}
