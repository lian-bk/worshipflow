-- WorshipFlow — Phase 3: Library (Songs, Media, Themes, Tags)
-- Run this in the Supabase SQL Editor AFTER 0001-0004.
--
-- Adds: song_slides (the labeled/colour-coded lyric slides a song splits
-- into), arrangements + arrangement_items (a reusable ordered playlist of
-- slides per song), themes (background/font/colour presets), tags +
-- song_tags + media_tags (search/filter), and extends media_assets with a
-- pluggable "storage source" so large video files never have to live in our
-- Supabase Storage bill.

-- Song slides ----------------------------------------------------------
-- A song is pasted as one block of lyrics (public.songs.lyrics, unchanged
-- from Phase 1) and then split into these labeled chunks. label_type drives
-- the consistent colour-coding in the UI; label_number distinguishes
-- "Verse 1" from "Verse 2"; custom_label is only used when label_type is
-- 'other', for anything that doesn't fit the standard set (e.g. "Interlude").

create type slide_label_type as enum (
  'verse', 'chorus', 'prechorus', 'bridge', 'intro', 'outro', 'tag', 'other'
);

create table public.song_slides (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  label_type slide_label_type not null default 'other',
  label_number integer,
  custom_label text,
  content text not null default '',
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Arrangements -----------------------------------------------------------
-- A named, reusable ordered sequence of a song's slides — the same slide
-- (e.g. Chorus) can appear more than once, so arrangement_items has no
-- uniqueness constraint on (arrangement_id, song_slide_id).

create table public.arrangements (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.arrangement_items (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid not null references public.arrangements (id) on delete cascade,
  song_slide_id uuid not null references public.song_slides (id) on delete cascade,
  display_order integer not null default 0
);

-- Themes -------------------------------------------------------------------
-- church_id is null for the 4 global starter presets (seeded below, visible
-- to every church, editable by nobody through the app) and set to a real
-- church for that church's own custom themes.

create table public.themes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references public.churches (id) on delete cascade,
  name text not null,
  background_color text not null default '#0f172a',
  background_image_path text,
  font_family text not null default 'system',
  text_color text not null default '#ffffff',
  is_starter boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.songs
  add column theme_id uuid references public.themes (id) on delete set null;

-- Tags -----------------------------------------------------------------
-- One shared tag vocabulary per church, reused across songs and media.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (church_id, name)
);

create table public.song_tags (
  song_id uuid not null references public.songs (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (song_id, tag_id)
);

create table public.media_tags (
  media_asset_id uuid not null references public.media_assets (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (media_asset_id, tag_id)
);

-- Media assets: pluggable storage source ------------------------------------
-- 'supabase' = the file itself lives in our Supabase Storage 'media' bucket
--   (storage_path is set) — used for images, PowerPoint originals, and the
--   slide images PowerPoint gets converted into.
-- 'local_reference' = we store nothing; external_reference is just a label
--   the church typed in (e.g. a filename) reminding them it lives on their
--   own presentation laptop. This is the default for video, to avoid
--   Supabase Storage costs on large files.
-- Designed so a future 'google_drive' source can be added later (a new
-- allowed value here, plus an external_reference holding the Drive file ID)
-- without changing this table's shape.

alter table public.media_assets
  add column storage_source text not null default 'supabase'
    check (storage_source in ('supabase', 'local_reference')),
  add column external_reference text,
  add column pptx_conversion_status text
    check (pptx_conversion_status in ('pending', 'processing', 'complete', 'failed')),
  add column source_media_id uuid references public.media_assets (id) on delete cascade,
  add column display_order integer not null default 0;

-- Helpful indexes ----------------------------------------------------------

create index on public.song_slides (song_id);
create index on public.arrangements (song_id);
create index on public.arrangement_items (arrangement_id);
create index on public.arrangement_items (song_slide_id);
create index on public.themes (church_id);
create index on public.tags (church_id);
create index on public.song_tags (tag_id);
create index on public.media_tags (tag_id);
create index on public.media_assets (source_media_id);

-- Row Level Security ---------------------------------------------------

alter table public.song_slides enable row level security;
alter table public.arrangements enable row level security;
alter table public.arrangement_items enable row level security;
alter table public.themes enable row level security;
alter table public.tags enable row level security;
alter table public.song_tags enable row level security;
alter table public.media_tags enable row level security;

create policy "church members manage song slides" on public.song_slides
  for all using (song_id in (select id from public.songs where church_id = public.current_church_id()))
  with check (song_id in (select id from public.songs where church_id = public.current_church_id()));

create policy "church members manage arrangements" on public.arrangements
  for all using (song_id in (select id from public.songs where church_id = public.current_church_id()))
  with check (song_id in (select id from public.songs where church_id = public.current_church_id()));

create policy "church members manage arrangement items" on public.arrangement_items
  for all using (
    arrangement_id in (
      select a.id from public.arrangements a
      join public.songs s on s.id = a.song_id
      where s.church_id = public.current_church_id()
    )
  )
  with check (
    arrangement_id in (
      select a.id from public.arrangements a
      join public.songs s on s.id = a.song_id
      where s.church_id = public.current_church_id()
    )
  );

-- Themes: everyone can see global starters + their own church's themes;
-- only their own church's themes can be created/edited/deleted (global
-- starters are seeded once below and are never editable through the app).

create policy "see starter or own themes" on public.themes
  for select using (church_id is null or church_id = public.current_church_id());

create policy "church members manage own themes" on public.themes
  for insert with check (church_id = public.current_church_id());

create policy "church members update own themes" on public.themes
  for update using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members delete own themes" on public.themes
  for delete using (church_id = public.current_church_id());

create policy "church members manage tags" on public.tags
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members manage song tags" on public.song_tags
  for all using (song_id in (select id from public.songs where church_id = public.current_church_id()))
  with check (song_id in (select id from public.songs where church_id = public.current_church_id()));

create policy "church members manage media tags" on public.media_tags
  for all using (media_asset_id in (select id from public.media_assets where church_id = public.current_church_id()))
  with check (media_asset_id in (select id from public.media_assets where church_id = public.current_church_id()));

-- Starter themes (4 presets, mirrors ProPresenter's built-in Themes) --------

insert into public.themes (church_id, name, background_color, font_family, text_color, is_starter) values
  (null, 'Classic Dark', '#0f172a', 'system', '#ffffff', true),
  (null, 'Warm Sunrise', '#7c2d12', 'system', '#fff7ed', true),
  (null, 'Clean Light', '#f8fafc', 'system', '#0f172a', true),
  (null, 'Deep Purple', '#2e1065', 'system', '#f5f3ff', true);

-- Supabase Storage bucket for media (images, PowerPoint originals, and the
-- slide images PowerPoint gets converted into). Videos referenced via
-- 'local_reference' never touch this bucket. Kept private — access always
-- goes through signed URLs the app generates for a logged-in church member,
-- never a public bucket URL.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- Storage objects are stored under a path starting with the church's own
-- id (e.g. "<church_id>/songs-bg/whatever.jpg"), so this policy reuses that
-- first path segment to scope access the same way every other table does.

create policy "church members manage their own media files"
on storage.objects for all
using (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_church_id()::text)
with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_church_id()::text);
