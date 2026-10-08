"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { HAS_SUPABASE } from "./env";
import { supabaseBrowser } from "./supabase/client";
import { emptySnapshot, TABLE_KEY, type Profile, type Snapshot, type TableName } from "./types";

export interface LoadResult {
  snapshot: Snapshot;
  profile: Profile;
  email: string | null;
}

type Row = Record<string, unknown>;

export interface Repo {
  mode: "supabase" | "local";
  load(): Promise<LoadResult>;
  insert(table: TableName, rows: Row[]): Promise<void>;
  update(table: TableName, id: string, patch: Row): Promise<void>;
  /** Delete rows matching every key in `match` (e.g. {id} or {idea_id, tag_id}). */
  remove(table: TableName, match: Record<string, string>): Promise<void>;
  removeIn(table: TableName, column: string, values: string[]): Promise<void>;
  updateProfile(patch: Partial<Profile>): Promise<void>;
  signOut(): Promise<void>;
  deleteEverything(): Promise<void>;
}

const ID_TABLES: TableName[] = ["ideas", "sources", "tags", "topics", "projects", "idea_links", "reflections"];
const ALL_TABLES: TableName[] = [
  "sources",
  "ideas",
  "tags",
  "topics",
  "projects",
  "idea_links",
  "reflections",
  "idea_tags",
  "idea_topics",
  "idea_projects",
];

function strip(row: Row): Row {
  const { user_id: _u, ...rest } = row;
  return rest;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
class SupabaseRepo implements Repo {
  mode = "supabase" as const;
  constructor(private db: SupabaseClient) {}

  private async fetchAll(table: TableName): Promise<Row[]> {
    const page = 1000;
    const rows: Row[] = [];
    for (let from = 0; ; from += page) {
      const { data, error } = await this.db
        .from(table)
        .select("*")
        .range(from, from + page - 1);
      if (error) throw new Error(`Couldn't load ${table}: ${error.message}`);
      rows.push(...(data ?? []).map(strip));
      if (!data || data.length < page) break;
    }
    return rows;
  }

  async load(): Promise<LoadResult> {
    const {
      data: { user },
    } = await this.db.auth.getUser();
    if (!user) throw new Error("You're signed out. Sign in again to open your garden.");

    const snapshot = emptySnapshot();
    const results = await Promise.all(ALL_TABLES.map((t) => this.fetchAll(t)));
    ALL_TABLES.forEach((t, i) => {
      (snapshot[TABLE_KEY[t]] as unknown as Row[]) = results[i];
    });

    let { data: profile } = await this.db
      .from("profiles")
      .select("display_name, theme, seeded")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) {
      const fallback = {
        id: user.id,
        display_name: (user.user_metadata?.display_name as string) ?? user.email?.split("@")[0] ?? null,
      };
      await this.db.from("profiles").upsert(fallback);
      profile = { display_name: fallback.display_name, theme: "system", seeded: false };
    }
    return { snapshot, profile: profile as Profile, email: user.email ?? null };
  }

  async insert(table: TableName, rows: Row[]) {
    if (!rows.length) return;
    const { error } = await this.db.from(table).insert(rows);
    if (error) throw new Error(error.message);
  }

  async update(table: TableName, id: string, patch: Row) {
    const { error } = await this.db.from(table).update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async remove(table: TableName, match: Record<string, string>) {
    const { error } = await this.db.from(table).delete().match(match);
    if (error) throw new Error(error.message);
  }

  async removeIn(table: TableName, column: string, values: string[]) {
    if (!values.length) return;
    for (let i = 0; i < values.length; i += 200) {
      const { error } = await this.db.from(table).delete().in(column, values.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  async updateProfile(patch: Partial<Profile>) {
    const {
      data: { user },
    } = await this.db.auth.getUser();
    if (!user) return;
    const { error } = await this.db.from("profiles").update(patch).eq("id", user.id);
    if (error) throw new Error(error.message);
  }

  async signOut() {
    await this.db.auth.signOut();
  }

  async deleteEverything() {
    const {
      data: { user },
    } = await this.db.auth.getUser();
    if (!user) return;
    // Deleting ideas cascades to joins, links and reflections.
    for (const t of ["ideas", "sources", "tags", "topics", "projects"] as TableName[]) {
      const { error } = await this.db.from(t).delete().eq("user_id", user.id);
      if (error) throw new Error(error.message);
    }
    await this.db.from("profiles").update({ seeded: true }).eq("id", user.id);
  }
}

// ---------------------------------------------------------------------------
// Local demo mode (browser storage)
// ---------------------------------------------------------------------------
const KEY = "idea-garden:v1";

interface LocalState {
  snapshot: Snapshot;
  profile: Profile;
}

class LocalRepo implements Repo {
  mode = "local" as const;
  private state: LocalState;

  constructor() {
    this.state = this.read();
  }

  private read(): LocalState {
    const fresh: LocalState = {
      snapshot: emptySnapshot(),
      profile: { display_name: "Ronnel", theme: "system", seeded: false },
    };
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return fresh;
      const parsed = JSON.parse(raw) as LocalState;
      return { snapshot: { ...emptySnapshot(), ...parsed.snapshot }, profile: { ...fresh.profile, ...parsed.profile } };
    } catch {
      return fresh;
    }
  }

  private write() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      throw new Error("This browser's storage is full or unavailable, so the change wasn't saved.");
    }
  }

  private rows(table: TableName): Row[] {
    return this.state.snapshot[TABLE_KEY[table]] as unknown as Row[];
  }

  private setRows(table: TableName, rows: Row[]) {
    (this.state.snapshot[TABLE_KEY[table]] as unknown as Row[]) = rows;
  }

  private cascade(table: TableName, ids: Set<string>) {
    const drop = (t: TableName, cols: string[]) =>
      this.setRows(
        t,
        this.rows(t).filter((r) => !cols.some((c) => ids.has(r[c] as string)))
      );
    if (table === "ideas") {
      drop("idea_tags", ["idea_id"]);
      drop("idea_topics", ["idea_id"]);
      drop("idea_projects", ["idea_id"]);
      drop("reflections", ["idea_id"]);
      drop("idea_links", ["source_idea_id", "target_idea_id"]);
    }
    if (table === "tags") drop("idea_tags", ["tag_id"]);
    if (table === "topics") drop("idea_topics", ["topic_id"]);
    if (table === "projects") drop("idea_projects", ["project_id"]);
    if (table === "sources") {
      this.setRows(
        "ideas",
        this.rows("ideas").map((r) => (ids.has(r.source_id as string) ? { ...r, source_id: null } : r))
      );
    }
  }

  async load(): Promise<LoadResult> {
    this.state = this.read();
    return {
      snapshot: structuredClone(this.state.snapshot),
      profile: { ...this.state.profile },
      email: null,
    };
  }

  async insert(table: TableName, rows: Row[]) {
    this.setRows(table, [...this.rows(table), ...rows.map((r) => ({ ...r }))]);
    this.write();
  }

  async update(table: TableName, id: string, patch: Row) {
    this.setRows(
      table,
      this.rows(table).map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    this.write();
  }

  async remove(table: TableName, match: Record<string, string>) {
    const removed = new Set<string>();
    this.setRows(
      table,
      this.rows(table).filter((r) => {
        const hit = Object.entries(match).every(([k, v]) => r[k] === v);
        if (hit && ID_TABLES.includes(table)) removed.add(r.id as string);
        return !hit;
      })
    );
    if (removed.size) this.cascade(table, removed);
    this.write();
  }

  async removeIn(table: TableName, column: string, values: string[]) {
    const set = new Set(values);
    const removed = new Set<string>();
    this.setRows(
      table,
      this.rows(table).filter((r) => {
        const hit = set.has(r[column] as string);
        if (hit && ID_TABLES.includes(table)) removed.add(r.id as string);
        return !hit;
      })
    );
    if (removed.size) this.cascade(table, removed);
    this.write();
  }

  async updateProfile(patch: Partial<Profile>) {
    this.state.profile = { ...this.state.profile, ...patch };
    this.write();
  }

  async signOut() {}

  async deleteEverything() {
    this.state = { snapshot: emptySnapshot(), profile: { ...this.state.profile, seeded: true } };
    this.write();
  }
}

let repo: Repo | null = null;
export function getRepo(): Repo {
  if (!repo) repo = HAS_SUPABASE ? new SupabaseRepo(supabaseBrowser()) : new LocalRepo();
  return repo;
}

export function resetLocalDemo() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
