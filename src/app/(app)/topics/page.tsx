"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Page } from "@/components/app-shell";
import { useLibrary } from "@/components/library";
import { Empty, PageHeader } from "@/components/idea-bits";
import { topicHue } from "@/lib/graph";
import { daysSince, displayTitle, plural } from "@/lib/text";
import { useTitle } from "@/lib/use-title";

export default function TopicsPage() {
  useTitle("Topics");
  const lib = useLibrary();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const topics = useMemo(
    () =>
      lib.data.topics
        .map((t) => {
          const ids = (lib.ideasByTopic.get(t.id) ?? []).filter((id) => !lib.ideaById.get(id)?.archived);
          const ideas = ids.map((id) => lib.ideaById.get(id)!).sort((a, b) => b.created_at.localeCompare(a.created_at));
          const recent = ideas.filter((i) => daysSince(i.created_at) <= 30).length;
          return { topic: t, ideas, recent };
        })
        .sort((a, b) => b.ideas.length - a.ideas.length || a.topic.name.localeCompare(b.topic.name)),
    [lib.data.topics, lib.ideasByTopic, lib.ideaById]
  );

  const unsorted = lib.ideas.filter((i) => !(lib.topicsByIdea.get(i.id) ?? []).length).length;

  return (
    <Page>
      <PageHeader title="Topics" description="Collections that gather related ideas, whatever source they came from.">
        <button className="btn-quiet" onClick={() => setAdding((a) => !a)}>
          <Plus size={15} /> New topic
        </button>
      </PageHeader>

      {adding && (
        <form
          className="mb-8 animate-fade space-y-3 rounded-md border border-line bg-sheet p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = lib.createTopic(name, description);
            router.push(`/topics/${id}`);
          }}
        >
          <input autoFocus className="field font-serif text-read" placeholder="Topic name, like Attention or Cities" value={name} onChange={(e) => setName(e.target.value)} aria-label="Topic name" />
          <input className="field" placeholder="What belongs here? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Description" />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost h-8" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button className="btn-primary h-8" disabled={!name.trim()}>
              Create topic
            </button>
          </div>
        </form>
      )}

      {topics.length ? (
        <ul className="divide-y divide-line">
          {topics.map(({ topic, ideas, recent }) => (
            <li key={topic.id}>
              <Link href={`/topics/${topic.id}`} className="group -mx-3 block rounded-md px-3 py-5 transition-colors hover:bg-sheet">
                <div className="flex items-baseline gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: topicHue(lib.topicOrder.get(topic.id) ?? 0, dark) }} />
                  <h2 className="flex-1 font-serif text-lead font-medium text-ink group-hover:text-juniper">{topic.name}</h2>
                  <span className="text-sm tabular-nums text-stem">{plural(ideas.length, "idea")}</span>
                </div>
                <div className="pl-[1.375rem]">
                  {topic.description && <p className="mt-0.5 text-stem">{topic.description}</p>}
                  {ideas.length > 0 && (
                    <p className="mt-2 line-clamp-2 font-serif text-[1.0625rem] leading-7 text-ink/80">
                      {ideas.slice(0, 3).map((i, n) => (
                        <span key={i.id}>
                          {n > 0 && <span className="text-faint">; </span>}
                          {displayTitle(i)}
                        </span>
                      ))}
                    </p>
                  )}
                  {recent > 0 && <p className="mt-1.5 text-xs text-faint">{plural(recent, "idea")} added in the last month</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No topics yet" action={<button className="btn-quiet" onClick={() => setAdding(true)}>Create a topic</button>}>
          Topics are broad areas you keep coming back to, like Learning, Economics or Design.
        </Empty>
      )}

      {unsorted > 0 && topics.length > 0 && (
        <p className="mt-10 text-sm text-stem">
          <Link href="/ideas?topic=none" className="underline decoration-line underline-offset-4 hover:decoration-juniper">
            {plural(unsorted, "idea")}
          </Link>{" "}
          {unsorted === 1 ? "isn't" : "aren't"} in any topic yet. Add topics from an idea&apos;s page.
        </p>
      )}
    </Page>
  );
}
