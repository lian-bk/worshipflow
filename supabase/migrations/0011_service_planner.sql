-- WorshipFlow — Phase: Service Planner
-- Run this in the Supabase SQL Editor AFTER 0001-0010.
--
-- service_items has existed since Phase 1 as a bare (title, item_type) row
-- with no link back to real content — it predates the Library (Phase 3),
-- which is where songs actually got their slides/arrangements. This adds
-- the missing foreign keys so a set-list item can point at a real song
-- (optionally a specific named arrangement of it) or a real media asset,
-- instead of only ever being a free-text title. A plain 'custom' item
-- (Announcements, Offering, Sermon, etc.) still has no back-reference —
-- title is all it needs.

alter table public.service_items
  add column if not exists song_id uuid references public.songs (id) on delete cascade,
  add column if not exists arrangement_id uuid references public.arrangements (id) on delete set null,
  add column if not exists media_asset_id uuid references public.media_assets (id) on delete cascade;

-- Backfill safety: no service_items exist yet in production (the Planner
-- page has only ever been a placeholder), but do this properly anyway.
update public.service_items set item_type = 'custom' where item_type is null;

alter table public.service_items
  alter column item_type set default 'custom',
  alter column item_type set not null;

alter table public.service_items
  add constraint service_items_type_check check (item_type in ('song', 'media', 'custom'));

create index if not exists service_items_occurrence_idx on public.service_items (service_occurrence_id);
create index if not exists service_items_song_idx on public.service_items (song_id);
create index if not exists service_items_media_idx on public.service_items (media_asset_id);
