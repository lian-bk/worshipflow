-- WorshipFlow — Phase 4: Church structure (Teams, People, Service Types)
-- Run this in the Supabase SQL Editor AFTER 0001-0005.
--
-- Three things this adds:
--  1. People with no login at all (some volunteers have no email) — this
--     means public.users can no longer assume every row has a matching
--     auth.users row, so we decouple the two (see "Decouple auth" below).
--  2. Per-church editable labels for the "Hotu"/"Bawmtu" role names.
--  3. Service types that are either a weekly recurring pattern (weekday +
--     time + location) or a special multi-date event (explicit dates in
--     service_occurrences, which already supported arbitrary dates).

-- Decouple auth: users.id no longer has to equal an auth.users id --------
-- auth_user_id is the new link to an actual login. It's null for a
-- no-login volunteer. For every person who DOES have a login, id and
-- auth_user_id are always set to the same value (exactly like id was used
-- everywhere already), so no existing code that does
-- `.eq("id", authUser.id)` needs to change.

alter table public.users
  add column auth_user_id uuid references auth.users (id) on delete set null;

update public.users set auth_user_id = id;

alter table public.users
  add constraint users_auth_user_id_key unique (auth_user_id);

-- Drop whatever the id -> auth.users(id) foreign key happens to be named
-- (found by lookup instead of assuming "users_id_fkey", so this works even
-- if Postgres or Supabase generated a different name for it).
do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'users'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'id'
    and ccu.table_schema = 'auth'
    and ccu.table_name = 'users'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.users drop constraint %I', fk_name);
  end if;
end $$;

alter table public.users alter column id set default gen_random_uuid();
alter table public.users alter column email drop not null;

alter table public.users
  add column account_status text not null default 'active'
    check (account_status in ('invited', 'active', 'no_login'));

update public.users set account_status = 'no_login' where auth_user_id is null;

-- Helper functions now key off auth_user_id (a no-login person is never the
-- one making a request, so this never has to handle a null case).

create or replace function public.current_church_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select church_id from public.users where auth_user_id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_owner from public.users where auth_user_id = auth.uid()), false);
$$;

create or replace function public.is_church_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_church_admin from public.users where auth_user_id = auth.uid()), false);
$$;

-- New helper: is the signed-in person the Hotu or Bawmtu of this one team?
-- (team_members.user_id is a public.users.id, which — for anyone who can
-- actually be signed in — is always equal to their auth_user_id/auth uid,
-- so comparing directly against auth.uid() here is correct.)

create or replace function public.is_team_leader(p_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and role in ('hotu', 'bawmtu')
  );
$$;

-- Update the two RLS policies that used to compare id = auth.uid() directly
-- for "is this my own row" checks — auth_user_id is the correct comparison
-- now that id itself may belong to a no-login person.

drop policy if exists "see self, churchmates, or all as owner" on public.users;
create policy "see self, churchmates, or all as owner" on public.users
  for select using (
    auth_user_id = auth.uid()
    or (church_id is not null and church_id = public.current_church_id())
    or public.is_owner()
  );

drop policy if exists "update own profile" on public.users;
create policy "update own profile" on public.users
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- The invite-acceptance flow needs to flip its own row from 'invited' to
-- 'active' (see src/app/invite/accept/actions.ts) — extend the Phase 1
-- column-level grant (originally full_name only) to allow that too. RLS
-- above still restricts this to a person's own row.
grant update (full_name, account_status) on public.users to authenticated;

-- Per-church editable role labels ------------------------------------------
-- Defaults match the words used in the build guide; a church can rename
-- them to "Leader"/"Assistant" or anything else without touching the
-- underlying 'hotu'/'bawmtu' enum values used everywhere else.

alter table public.churches
  add column hotu_label text not null default 'Hotu',
  add column bawmtu_label text not null default 'Bawmtu';

-- Service types: weekly recurring vs. a special multi-date event ----------
-- 'weekly' uses default_weekday/default_start_time/default_location
-- directly. 'dates' ignores default_weekday and instead relies on however
-- many rows get added to service_occurrences (already date-based, already
-- supports exactly this — no schema change needed there).

alter table public.service_types
  add column pattern_type text not null default 'weekly'
    check (pattern_type in ('weekly', 'dates'));

-- Row Level Security: tighten teams/positions/members/service types -------
-- Phase 1 left these wide open ("any church member can manage") as a
-- placeholder. Phase 4's actual rule: Admin manages everything in their
-- church; a team's own Hotu/Bawmtu manage only that team; everyone else in
-- the church can look but not touch.

drop policy if exists "church members manage their teams" on public.teams;
create policy "everyone in the church sees teams" on public.teams
  for select using (church_id = public.current_church_id());
create policy "admin manages teams" on public.teams
  for insert with check (church_id = public.current_church_id() and public.is_church_admin());
create policy "admin updates teams" on public.teams
  for update using (church_id = public.current_church_id() and public.is_church_admin())
  with check (church_id = public.current_church_id() and public.is_church_admin());
create policy "admin deletes teams" on public.teams
  for delete using (church_id = public.current_church_id() and public.is_church_admin());

drop policy if exists "church members manage team positions" on public.team_positions;
create policy "everyone in the church sees team positions" on public.team_positions
  for select using (team_id in (select id from public.teams where church_id = public.current_church_id()));
create policy "admin or team leader manages team positions" on public.team_positions
  for insert with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );
create policy "admin or team leader updates team positions" on public.team_positions
  for update using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  )
  with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );
create policy "admin or team leader deletes team positions" on public.team_positions
  for delete using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );

drop policy if exists "church members manage team members" on public.team_members;
create policy "everyone in the church sees team members" on public.team_members
  for select using (team_id in (select id from public.teams where church_id = public.current_church_id()));
create policy "admin or team leader manages team roster" on public.team_members
  for insert with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );
create policy "admin or team leader updates team roster" on public.team_members
  for update using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  )
  with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );
create policy "admin or team leader removes team roster" on public.team_members
  for delete using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );

drop policy if exists "church members manage service types" on public.service_types;
create policy "everyone in the church sees service types" on public.service_types
  for select using (church_id = public.current_church_id());
create policy "admin manages service types" on public.service_types
  for insert with check (church_id = public.current_church_id() and public.is_church_admin());
create policy "admin updates service types" on public.service_types
  for update using (church_id = public.current_church_id() and public.is_church_admin())
  with check (church_id = public.current_church_id() and public.is_church_admin());
create policy "admin deletes service types" on public.service_types
  for delete using (church_id = public.current_church_id() and public.is_church_admin());

drop policy if exists "church members manage service occurrences" on public.service_occurrences;
create policy "everyone in the church sees service occurrences" on public.service_occurrences
  for select using (
    service_type_id in (select id from public.service_types where church_id = public.current_church_id())
  );
create policy "admin manages service occurrences" on public.service_occurrences
  for insert with check (
    service_type_id in (select id from public.service_types where church_id = public.current_church_id())
    and public.is_church_admin()
  );
create policy "admin updates service occurrences" on public.service_occurrences
  for update using (
    service_type_id in (select id from public.service_types where church_id = public.current_church_id())
    and public.is_church_admin()
  )
  with check (
    service_type_id in (select id from public.service_types where church_id = public.current_church_id())
    and public.is_church_admin()
  );
create policy "admin deletes service occurrences" on public.service_occurrences
  for delete using (
    service_type_id in (select id from public.service_types where church_id = public.current_church_id())
    and public.is_church_admin()
  );

-- Fix redeem_license_key (0004) for the auth decoupling above ------------
-- A newly-registered church's founder IS a real login, so their row needs
-- auth_user_id set to the same id — otherwise current_church_id()/
-- is_church_admin() (which now key off auth_user_id) would come back empty
-- for anyone who registers a church after this migration runs.

create or replace function public.redeem_license_key(
  p_key_code text,
  p_church_name text,
  p_contact_email text,
  p_language_code text,
  p_user_id uuid,
  p_user_email text,
  p_full_name text
)
returns table (church_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.license_keys%rowtype;
  v_church_id uuid;
  v_duration integer;
  v_expires_at timestamptz;
begin
  select * into v_key
  from public.license_keys
  where key_code = p_key_code
  for update;

  if v_key.id is null then
    raise exception 'INVALID_KEY';
  end if;

  if v_key.status <> 'unused' then
    raise exception 'KEY_ALREADY_USED';
  end if;

  if v_key.expires_at is not null and v_key.expires_at < now() then
    raise exception 'KEY_EXPIRED';
  end if;

  select duration_in_days into v_duration
  from public.license_plans
  where plan_code = v_key.plan_code;

  if v_duration is null then
    v_expires_at := null; -- Lifetime
  else
    v_expires_at := now() + (v_duration || ' days')::interval;
  end if;

  insert into public.churches (name, contact_email, language_code)
  values (p_church_name, p_contact_email, coalesce(p_language_code, 'en'))
  returning id into v_church_id;

  update public.license_keys
  set church_id = v_church_id,
      status = 'active',
      activated_at = now(),
      expires_at = v_expires_at
  where id = v_key.id;

  update public.churches
  set license_key_id = v_key.id
  where id = v_church_id;

  insert into public.users (id, auth_user_id, church_id, email, full_name, is_owner, is_church_admin, account_status)
  values (p_user_id, p_user_id, v_church_id, p_user_email, p_full_name, false, true, 'active')
  on conflict (id) do update
    set auth_user_id = excluded.auth_user_id,
        church_id = excluded.church_id,
        full_name = excluded.full_name,
        is_church_admin = true,
        account_status = 'active';

  return query select v_church_id;
end;
$$;

revoke all on function public.redeem_license_key(text, text, text, text, uuid, text, text) from public;
grant execute on function public.redeem_license_key(text, text, text, text, uuid, text, text) to service_role;
