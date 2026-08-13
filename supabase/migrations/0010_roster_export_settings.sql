-- WorshipFlow — Phase 5c: roster export/printing
-- Run this in the Supabase SQL Editor AFTER 0001-0009.
--
-- Adds two small, church-editable text fields used on the printed/exported
-- monthly roster sheet: a short tagline shown under the church name in the
-- header band, and a footer line for service times/locations (e.g.
-- "Hla Cin Caan: Zaan Khawm; 7:15-7:45pm (FCC Chapel)..."). Both are plain
-- optional text — nothing here is required, and existing churches get empty
-- defaults so nothing changes until they fill these in on the Settings page.

alter table public.churches
  add column if not exists tagline text not null default '',
  add column if not exists roster_footer_text text not null default '';
