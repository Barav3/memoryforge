-- MemoryForge schema_v2.sql
-- Run this in Supabase → SQL Editor AFTER the original schema.sql
-- Adds: profiles (theme storage) + published_decks (community discovery)
-- ============================================================

-- PROFILES — one row per user, stores their theme config as JSON
create table if not exists profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  theme       jsonb       not null default '{"preset":"digital"}',
  created_at  timestamptz default now()
);

alter table profiles enable row level security;

create policy "users can select own profile"
  on profiles for select using (auth.uid() = id);

create policy "users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update using (auth.uid() = id);

-- PUBLISHED_DECKS — community deck sharing
-- SELECT is open to all authenticated users.
-- INSERT/UPDATE/DELETE restricted to the deck owner.
create table if not exists published_decks (
  id               text        primary key,
  user_id          uuid        references auth.users(id) on delete cascade,
  username         text        not null default 'anon',
  deck_name        text        not null,
  deck_description text        default '',
  deck_emoji       text        default '📚',
  deck_color       text        default '#1144DD',
  cards            jsonb       not null default '[]',
  card_count       integer     default 0,
  imports          integer     default 0,
  published_at     timestamptz default now()
);

alter table published_decks enable row level security;

-- Anyone authenticated can read published decks
create policy "authenticated users can read published decks"
  on published_decks for select using (auth.role() = 'authenticated');

create policy "users can publish own decks"
  on published_decks for insert with check (auth.uid() = user_id);

create policy "users can update own published decks"
  on published_decks for update using (auth.uid() = user_id);

create policy "users can delete own published decks"
  on published_decks for delete using (auth.uid() = user_id);

-- Indexes
create index if not exists published_decks_published_at_idx on published_decks(published_at desc);
create index if not exists published_decks_user_id_idx      on published_decks(user_id);
create index if not exists published_decks_name_idx         on published_decks using gin(to_tsvector('english', deck_name));
