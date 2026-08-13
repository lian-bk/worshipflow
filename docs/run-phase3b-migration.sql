-- WorshipFlow — Phase 3 follow-up: song language, musical key, songbook number
-- Run this in the Supabase SQL Editor AFTER 0001-0006.
--
-- Supports importing a real songbook (e.g. a JSON export with title, song
-- number, musical key, category, and language per song) and picking the
-- right font automatically for languages that need one — Falam Chin lyrics
-- in the sample data use a legacy "custom font" encoding (a backslash or a
-- "|" character stands in for a special glyph that only renders correctly
-- in that specific font), so the app needs to know which songs are Falam so
-- it can apply that font just to them.

alter table public.songs
  add column lang text not null default 'en',
  add column musical_key text,
  add column songbook_number integer;

comment on column public.songs.lang is
  'Free-text language code for this song''s lyrics, e.g. en, falam, myanmar — drives which font the lyrics render in.';
