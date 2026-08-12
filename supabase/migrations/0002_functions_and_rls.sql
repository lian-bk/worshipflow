-- WorshipFlow — Phase 1: helper functions, Row Level Security, and column locks
-- Run this in the Supabase SQL Editor AFTER 0001_schema.sql.

-- Helper functions ---------------------------------------------------------
-- security definer + a fixed search_path lets these look up the CALLING
-- user's own row in public.users without re-triggering RLS on that table
-- (which would otherwise cause infinite recursion), while never letting a
-- caller pass in someone else's id.

create or replace function public.current_church_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select church_id from public.users where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_owner from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_church_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_church_admin from public.users where id = auth.uid()), false);
$$;

-- Turn on Row Level Security everywhere ------------------------------------
-- With RLS on and no matching policy, a table defaults to "nobody can see or
-- touch this row" — so every table below needs explicit policies, which is
-- exactly the safe default we want.

alter table public.license_plans enable row level security;
alter table public.license_keys enable row level security;
alter table public.churches enable row level security;
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_positions enable row level security;
alter table public.service_types enable row level security;
alter table public.service_occurrences enable row level security;
alter table public.rosters enable row level security;
alter table public.roster_assignments enable row level security;
alter table public.songs enable row level security;
alter table public.media_assets enable row level security;
alter table public.service_items enable row level security;

-- Licensing data: Owner only -------------------------------------------
-- Registration itself (checking a key, marking it active) happens through a
-- server action using the service_role key, which bypasses RLS entirely —
-- so a brand-new person with no account yet can still redeem a key. These
-- policies only govern what a logged-in, non-owner person can see, which is
-- nothing.

create policy "owner manages license plans" on public.license_plans
  for all using (public.is_owner()) with check (public.is_owner());

create policy "owner manages license keys" on public.license_keys
  for all using (public.is_owner()) with check (public.is_owner());

-- Churches ---------------------------------------------------------------
-- Members of a church can see their own church's record; the Owner can see
-- every church (needed for the Owner Console in Phase 2). Creating a church
-- happens via the service-role registration flow, not directly by users, so
-- there is no INSERT policy for logged-in users here.

create policy "see own church or all as owner" on public.churches
  for select using (id = public.current_church_id() or public.is_owner());

create policy "admins update own church" on public.churches
  for update using (id = public.current_church_id() and public.is_church_admin())
  with check (id = public.current_church_id() and public.is_church_admin());

-- Users --------------------------------------------------------------------
-- Everyone can see their own row and their churchmates' rows (needed to show
-- names in team rosters); the Owner can see everyone. Creating a user row
-- happens via the service-role registration/invite flow only — there is
-- deliberately no INSERT policy for the authenticated role.

create policy "see self, churchmates, or all as owner" on public.users
  for select using (
    id = auth.uid()
    or (church_id is not null and church_id = public.current_church_id())
    or public.is_owner()
  );

create policy "update own profile" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Column-level lock on is_owner / is_church_admin / church_id --------------
-- RLS controls which ROWS a policy allows; it can't by itself stop someone
-- from editing specific COLUMNS on a row they're otherwise allowed to
-- update. So on top of the policy above, we revoke UPDATE on the whole
-- table from ordinary logged-in users and re-grant it for only the columns
-- that are safe for someone to change about themselves. is_owner,
-- is_church_admin, and church_id can then only ever be changed by the
-- service_role key (server actions) or directly in the Supabase dashboard —
-- never through the app's normal UI.

revoke update on public.users from authenticated;
grant update (full_name) on public.users to authenticated;

-- Teams, positions, service types: scoped to one church ---------------
-- Phase 1 keeps this simple — any signed-in member of a church can manage
-- their church's teams/positions/service types. Phase 4 tightens this down
-- to Admin-only (for teams/service types) and Hotu/Bawmtu-only (for a
-- team's own positions), per the roadmap.

create policy "church members manage their teams" on public.teams
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members manage team positions" on public.team_positions
  for all using (team_id in (select id from public.teams where church_id = public.current_church_id()))
  with check (team_id in (select id from public.teams where church_id = public.current_church_id()));

create policy "church members manage team members" on public.team_members
  for all using (team_id in (select id from public.teams where church_id = public.current_church_id()))
  with check (team_id in (select id from public.teams where church_id = public.current_church_id()));

create policy "church members manage service types" on public.service_types
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members manage service occurrences" on public.service_occurrences
  for all using (service_type_id in (select id from public.service_types where church_id = public.current_church_id()))
  with check (service_type_id in (select id from public.service_types where church_id = public.current_church_id()));

-- Rosters --------------------------------------------------------------

create policy "church members manage rosters" on public.rosters
  for all using (team_id in (select id from public.teams where church_id = public.current_church_id()))
  with check (team_id in (select id from public.teams where church_id = public.current_church_id()));

create policy "church members manage roster assignments" on public.roster_assignments
  for all using (
    roster_id in (
      select r.id from public.rosters r
      join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
    )
  )
  with check (
    roster_id in (
      select r.id from public.rosters r
      join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
    )
  );

-- Library & service planning ------------------------------------------

create policy "church members manage songs" on public.songs
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members manage media assets" on public.media_assets
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());

create policy "church members manage service items" on public.service_items
  for all using (church_id = public.current_church_id())
  with check (church_id = public.current_church_id());
