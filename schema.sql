-- MemoryForge — Supabase Schema
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================================

-- DECKS TABLE
create table if not exists decks (
  id          text        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  description text        default '',
  color       text        default '#0066FF',
  emoji       text        default '📚',
  created_at  timestamptz default now()
);

-- CARDS TABLE
create table if not exists cards (
  id             text        primary key,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  deck_id        text        references decks(id) on delete set null,
  front          text        not null default '',
  back           text        not null default '',
  tags           text[]      not null default '{}',
  interval       integer     not null default 1,
  ease_factor    numeric     not null default 2.5,
  repetitions    integer     not null default 0,
  next_review    timestamptz,
  last_review    timestamptz,
  review_history integer[]   not null default '{}',
  created_at     timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Users can only read and write their own rows.
-- The anon/service key still works from your edge function.
-- ============================================================

alter table decks enable row level security;
alter table cards enable row level security;

-- Decks policies
create policy "users can select own decks"
  on decks for select using (auth.uid() = user_id);

create policy "users can insert own decks"
  on decks for insert with check (auth.uid() = user_id);

create policy "users can update own decks"
  on decks for update using (auth.uid() = user_id);

create policy "users can delete own decks"
  on decks for delete using (auth.uid() = user_id);

-- Cards policies
create policy "users can select own cards"
  on cards for select using (auth.uid() = user_id);

create policy "users can insert own cards"
  on cards for insert with check (auth.uid() = user_id);

create policy "users can update own cards"
  on cards for update using (auth.uid() = user_id);

create policy "users can delete own cards"
  on cards for delete using (auth.uid() = user_id);

-- ============================================================
-- INDEXES (performance)
-- ============================================================

create index if not exists cards_user_id_idx    on cards(user_id);
create index if not exists cards_deck_id_idx    on cards(deck_id);
create index if not exists cards_next_review_idx on cards(next_review);
create index if not exists decks_user_id_idx    on decks(user_id);
