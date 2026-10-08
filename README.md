# Idea Garden 

A personal bank of ideas you've encountered and want to keep thinking about: a commonplace book with linked ideas, backlinks, a knowledge graph, and resurfacing.

**Capture → Understand → Connect → Resurface**

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS and Supabase (Auth, Postgres, Row Level Security). Optional AI features use the Claude API.

---

## Try it in 30 seconds (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys configured, the app runs in **demo mode**:

- ideas are stored in your browser's local storage
- a sample garden is planted on first launch
- there is no sign-in

Everything else works the same, so demo mode is a good way to evaluate the app or deploy a quick preview.

---

## Full setup with Supabase

### 1. Create a project

Create a project at [supabase.com](https://supabase.com). Postgres 15 or newer is required; new projects already meet this.

### 2. Create the schema

Open **SQL Editor** in the Supabase dashboard. Paste in the contents of `supabase/migrations/0001_idea_garden.sql` and run it.

Alternatively, with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates the following tables:

| Table | Purpose |
| --- | --- |
| `profiles` | Display name, theme, whether the sample garden was planted |
| `ideas` | The primary object: title, content, personal thoughts, source, location, status (inbox/active), favorite, archived, timestamps |
| `sources` | Book, paper, article, video, podcast, lecture, conversation, website, observation |
| `tags`, `idea_tags` | Free-form tags (many-to-many) |
| `topics`, `idea_topics` | Curated collections (many-to-many) |
| `idea_links` | Explicit connections with an optional relationship type |
| `projects`, `idea_projects` | Optional projects (many-to-many) |
| `reflections` | Dated later thoughts on an idea |

**Privacy model.** Every table has RLS enabled, with select, insert, update and delete policies restricted to `user_id = auth.uid()`.

- `user_id` defaults to `auth.uid()`.
- Join tables use composite foreign keys on `(id, user_id)`, so a row can never connect your idea to someone else's tag, topic, project or idea.
- A trigger creates a profile on sign-up.
- Another trigger bumps `updated_at` only when an idea's writing changes. Viewing or favoriting an idea doesn't count as an edit.

### 3. Configure auth

In **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` for local work, or your production URL.
- **Redirect URLs:** add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.

Email + password and email magic links both work out of the box. If you'd rather not confirm emails during development, turn off **Confirm email** under Authentication → Providers → Email.

### 4. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Where to find it |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Project Settings → API → anon public key |
| `ANTHROPIC_API_KEY` | optional | [console.anthropic.com](https://console.anthropic.com). Enables AI features |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-sonnet-5-5` |

Then:

```bash
npm run dev
```

You'll be sent to `/login`. Create an account and your garden opens with the sample ideas planted.

---

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repo. The framework preset is detected as Next.js.
3. Add the environment variables above under **Settings → Environment Variables**.
4. Deploy, then add `https://<your-vercel-domain>/auth/callback` to Supabase's redirect URLs. Set the Site URL to your Vercel domain.

If you skip the Supabase variables, the deployment runs in demo mode.

---

## Using it

| Shortcut | Action |
| --- | --- |
| `N` | New idea |
| `/` | Search |
| `⌘K` or `Ctrl K` | Command palette (search ideas, topics, sources, projects; run commands) |
| `G` | Connections graph |
| `R` | Random idea |
| `E` | Edit the open idea |
| `[[` | Link to another idea while writing |
| `⌘↵` or `Ctrl ↵` | Save, or finish editing |
| `⌘B`, `⌘I`, `⌘⇧H` | Bold, italic, highlight |
| `→` | Next idea (in Random Idea) |
| `Esc` | Close a dialog |

**Capture**

- Anything saved with only the idea text goes to the **Inbox**, so capture never slows you down.
- Add a title, source, tags or your own thoughts and it's saved straight to your ideas.
- Closing the capture window keeps your draft.

**Wiki links**

- Type `[[` to search your ideas and insert a link.
- Linking to a title that doesn't exist yet creates a dashed link. Click it to capture that idea.
- Renaming an idea rewrites every `[[link]]` that points to it, including links in project notes.
- Every idea shows **Linked from** (backlinks from ideas and projects).

**Connections** can be plain ("just connected") or typed: related to, supports, contradicts, expands, example of, caused by, reminds me of. Contradictions are drawn dashed in the graph and collected on Explore.

**Search** covers titles, content, your thoughts, reflections, sources, authors, tags and topics. Operators:

- `#tag`
- `tag:learning`
- `topic:psychology`
- `author:kestrel`
- `source:"theory of measurement"`

Below exact matches, **Nearby ideas** suggests ideas that share vocabulary. With AI enabled, **Search by meaning** finds ideas that don't use your words at all.

**Resurfacing**

- Home shows one idea you haven't opened in a while.
- **Random Idea** is a flashcard-like mode weighted toward long-unseen ideas. It has a reflection prompt, and any reflection you've typed is saved when you move on.
- **Explore** shows forgotten ideas, highly connected ideas, emerging topics, clusters of closely linked ideas, and contradictions.

**Growth marks.** The small sprout beside each idea shows how connected it is: seed (0 connections), sprout (1–2), growing (3–4), flourishing (5+).

### AI features (optional)

When `ANTHROPIC_API_KEY` is set, these appear:

- **Suggest connections** on an idea page and in the Connect dialog. You approve each one.
- **Search by meaning** in All Ideas.
- **Ask my library** on Explore. Answers cite your ideas with numbered links.
- **Find possible contradictions** on Explore. You decide which to mark.
- **Summarize my thinking** on a topic page.

How the AI stays grounded in your library:

- When signed in, the server reads your library from Supabase as you, so RLS applies.
- The model is told to work only from your saved ideas.
- Any idea ID it returns that doesn't exist in your library is discarded before reaching the browser.
- Without the key, the AI controls are hidden. Local suggestions (TF-IDF similarity) still power "Related ideas" and "May connect to".

### Your data

**Settings** has:

- export to Markdown or JSON
- tag rename and delete
- remove or restore the sample garden
- delete everything

---

## Project structure

```
src/
  app/
    (app)/            Signed-in app: home, ideas, inbox, topics, sources,
                      connections, explore, random, projects, settings, account
    api/ai/route.ts   AI endpoint (grounded in the user's own ideas)
    auth/callback/    Email confirmation / magic link / reset handler
    login/            Sign in and sign up
  components/
    library.tsx       Loads the garden, derives indexes (backlinks, degrees,
                      search records, similarity, clusters), optimistic mutations
    app-shell.tsx     Sidebar, mobile nav, global shortcuts, theme sync
    capture.tsx       Inline + modal capture
    wiki-editor.tsx   Textarea editor with [[ autocomplete and shortcuts
    markdown.tsx      Small, safe Markdown renderer with wiki links
    graph-view.tsx    Canvas force-directed graph (d3-force)
    palette.tsx       Command palette
    connect-dialog.tsx
  lib/
    repo.ts           Persistence: Supabase or browser storage, one interface
    search.ts         Weighted keyword search with operators
    similarity.ts     TF-IDF related-idea index
    graph.ts          Label-propagation clusters, topic colours
    seed.ts           Sample garden (fictional sources, paraphrased ideas)
    wiki.ts           Wiki link parsing and renaming
supabase/migrations/  Schema, triggers and RLS policies
```

**Design notes**

- The whole library is loaded once per session and searched in memory. This keeps search, the graph, backlinks and `[[` autocomplete instant for personal-scale libraries of thousands of ideas.
- Writes are optimistic. If one fails, you're told what happened and the library reloads from the server.
- Loading pages through 1,000-row ranges keeps it working past Supabase's default row limit.
- For very large libraries, the natural next steps are:
  - server-side full-text search (a `tsvector` column with a GIN index)
  - pgvector embeddings for semantic search

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # TypeScript only
```
