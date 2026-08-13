-- WorshipFlow — Phase 5b: fix the old auth foreign key still blocking
-- no-login people ("Add by name" on a team, and this Settings page's
-- sample-team importer both hit it).
-- Run this in the Supabase SQL Editor AFTER 0001-0008.
--
-- Migration 0006 (Phase 4) was supposed to drop the original
-- users.id -> auth.users(id) foreign key — a no-login volunteer's id is
-- just a random UUID with no matching auth.users row, so that FK can never
-- be satisfied for them. 0006 looked the constraint up dynamically by shape
-- (querying information_schema) instead of assuming a name, specifically
-- to be safe — but that lookup came back empty in production. Postgres/
-- Supabase can restrict information_schema visibility across schemas in a
-- way that hides a constraint referencing an auth.* table even though the
-- constraint itself is still fully in effect, which is what happened here:
-- the drop silently found nothing to do, and the old FK has been quietly
-- blocking every no-login person created since. The exact name is now
-- confirmed from the live error, so this drops it directly.

alter table public.users drop constraint if exists users_id_fkey;
