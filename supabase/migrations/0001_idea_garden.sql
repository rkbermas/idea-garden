-- Idea Garden schema
-- Every table is private to its owner. user_id defaults to auth.uid(), and
-- composite foreign keys (id, user_id) make it impossible for a join row to
-- point at another person's idea, tag, topic or project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  seeded boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Sources (secondary to ideas)
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 400),
  author text,
  source_type text not null default 'other' check (source_type in (
    'book', 'paper', 'article', 'video', 'podcast', 'lecture',
    'conversation', 'website', 'observation', 'other'
  )),
  url text,
  publication_date text,
  notes text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create index sources_user_idx on public.sources (user_id);

-- ---------------------------------------------------------------------------
-- Ideas (the primary object)
-- ---------------------------------------------------------------------------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  content text not null default '',
  personal_thoughts text,
  source_id uuid,
  source_location text,
  status text not null default 'active' check (status in ('inbox', 'active')),
  favorite boolean not null default false,
  archived boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_viewed_at timestamptz,
  unique (id, user_id),
  foreign key (source_id, user_id) references public.sources (id, user_id) on delete set null (source_id)
);
create index ideas_user_created_idx on public.ideas (user_id, created_at desc);
create index ideas_user_status_idx on public.ideas (user_id, status) where archived = false;
create index ideas_source_idx on public.ideas (source_id);

-- Only bump updated_at when the writing changes, so viewing or favoriting an
-- idea does not count as an edit.
create or replace function public.touch_idea()
returns trigger
language plpgsql
as $$
begin
  if (new.title, new.content, new.personal_thoughts, new.source_id, new.source_location)
     is distinct from
     (old.title, old.content, old.personal_thoughts, old.source_id, old.source_location) then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger ideas_touch before update on public.ideas
  for each row execute function public.touch_idea();

-- ---------------------------------------------------------------------------
-- Tags (free-form)
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.idea_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idea_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, tag_id),
  foreign key (idea_id, user_id) references public.ideas (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index idea_tags_tag_idx on public.idea_tags (tag_id);

-- ---------------------------------------------------------------------------
-- Topics (curated collections)
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.idea_topics (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idea_id uuid not null,
  topic_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, topic_id),
  foreign key (idea_id, user_id) references public.ideas (id, user_id) on delete cascade,
  foreign key (topic_id, user_id) references public.topics (id, user_id) on delete cascade
);
create index idea_topics_topic_idx on public.idea_topics (topic_id);

-- ---------------------------------------------------------------------------
-- Explicit connections between ideas
-- (Wiki links written inside idea text are parsed from content.)
-- ---------------------------------------------------------------------------
create table public.idea_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_idea_id uuid not null,
  target_idea_id uuid not null,
  relationship_type text check (relationship_type in (
    'related', 'supports', 'contradicts', 'expands', 'example_of', 'caused_by', 'reminds_me_of'
  )),
  note text,
  created_at timestamptz not null default now(),
  check (source_idea_id <> target_idea_id),
  unique (source_idea_id, target_idea_id),
  foreign key (source_idea_id, user_id) references public.ideas (id, user_id) on delete cascade,
  foreign key (target_idea_id, user_id) references public.ideas (id, user_id) on delete cascade
);
create index idea_links_target_idx on public.idea_links (target_idea_id);
create index idea_links_user_created_idx on public.idea_links (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Projects (optional, light)
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.idea_projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idea_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (idea_id, project_id),
  foreign key (idea_id, user_id) references public.ideas (id, user_id) on delete cascade,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index idea_projects_project_idx on public.idea_projects (project_id);

-- ---------------------------------------------------------------------------
-- Reflections (later thoughts on an idea, e.g. from Random Idea)
-- ---------------------------------------------------------------------------
create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  idea_id uuid not null,
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now(),
  foreign key (idea_id, user_id) references public.ideas (id, user_id) on delete cascade
);
create index reflections_idea_idx on public.reflections (idea_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: owners only, on every table
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy "profiles: owner can read" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: owner can update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: owner can insert" on public.profiles
  for insert with check (id = auth.uid());

do $$
declare
  t text;
begin
  foreach t in array array[
    'sources', 'ideas', 'tags', 'idea_tags', 'topics', 'idea_topics',
    'idea_links', 'projects', 'idea_projects', 'reflections'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s: owner select" on public.%1$I for select using (user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s: owner insert" on public.%1$I for insert with check (user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s: owner update" on public.%1$I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s: owner delete" on public.%1$I for delete using (user_id = auth.uid())', t);
  end loop;
end;
$$;
