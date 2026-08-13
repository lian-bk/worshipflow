-- WorshipFlow — Phase 5: Roster builder
-- Run this in the Supabase SQL Editor AFTER 0001-0007.
--
-- What this adds:
--  1. service_occurrences can now belong to ONE roster privately (an extra
--     one-off date a Hotu adds, e.g. a 5-night crusade) instead of always
--     being a church-wide date shared across every team via a service_type.
--     Exactly one of service_type_id / roster_id is set on every row.
--  2. roster_notes — a per-team, per-date note (e.g. "P&W Hlazir Nak(3)"),
--     kept separate from service_occurrences.note (which stays the
--     Admin-only, church-wide note set on the Service Types page, e.g.
--     "Bible Sunday") so two teams can annotate the same shared date
--     differently without needing write access to each other's roster.
--  3. Unique constraints so "New Month" can safely be called by more than
--     one team's Hotu for the same church-wide date without duplicating
--     rows, and so a single roster cell (date + position) upserts cleanly.
--  4. Tightened RLS on rosters/roster_assignments (Phase 1 left these wide
--     open) to the same Admin-or-team-leader-write / everyone-in-church-read
--     rule Phase 4 already applied to teams/team_positions/service_types.
--  5. A respond_to_assignment() function so a person can accept/decline
--     their OWN assignment without needing a raw table UPDATE grant that
--     would also let them reassign the row to someone else.

-- service_occurrences: allow a private, roster-only date -------------------

alter table public.service_occurrences
  alter column service_type_id drop not null,
  add column roster_id uuid references public.rosters (id) on delete cascade,
  add constraint service_occurrences_scope_check check (
    (service_type_id is not null and roster_id is null) or
    (service_type_id is null and roster_id is not null)
  );

-- Prevents two different teams' "New Month" from creating duplicate rows
-- for the same shared (service_type, date) — the app upserts against this.
-- A plain (non-partial) unique constraint is used on purpose, not a partial
-- index: Postgres treats every NULL as distinct for uniqueness purposes, so
-- roster-only rows (service_type_id is null) never conflict with each other
-- here regardless of date — exactly the behavior we want — while still
-- letting ON CONFLICT (service_type_id, date) be inferred directly (a
-- partial index can't be used as an upsert target without also repeating
-- its WHERE clause in the query, which PostgREST's upsert has no way to do).

-- Safety first: the Service Types page had no de-dupe check before this,
-- so if the same date was ever added twice by hand for one service type,
-- adding the constraint below would fail. Clear out any such duplicates
-- (keeping the earliest row) before adding it.
delete from public.service_occurrences a
using public.service_occurrences b
where a.service_type_id is not null
  and a.service_type_id = b.service_type_id
  and a.date = b.date
  and a.id > b.id;

alter table public.service_occurrences
  add constraint service_occurrences_service_type_date_key unique (service_type_id, date);

-- roster_notes ---------------------------------------------------------

create table public.roster_notes (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references public.rosters (id) on delete cascade,
  service_occurrence_id uuid not null references public.service_occurrences (id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  unique (roster_id, service_occurrence_id)
);

alter table public.roster_notes enable row level security;

-- roster_assignments: one cell per (roster, date, position) ----------------

alter table public.roster_assignments
  add constraint roster_assignments_cell_key unique (roster_id, service_occurrence_id, team_position_id);

-- Row Level Security: tighten rosters/roster_assignments --------------------
-- Same rule as Phase 4: Admin manages everything in their church; a team's
-- own Hotu/Bawmtu manage only that team's rosters; everyone else in the
-- church can look (needed for cross-team conflict warnings and "My
-- Schedule") but not touch.

drop policy if exists "church members manage rosters" on public.rosters;

create policy "everyone in the church sees rosters" on public.rosters
  for select using (team_id in (select id from public.teams where church_id = public.current_church_id()));

create policy "admin or team leader creates rosters" on public.rosters
  for insert with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );

create policy "admin or team leader updates rosters" on public.rosters
  for update using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  )
  with check (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );

create policy "admin or team leader deletes rosters" on public.rosters
  for delete using (
    team_id in (select id from public.teams where church_id = public.current_church_id())
    and (public.is_church_admin() or public.is_team_leader(team_id))
  );

drop policy if exists "church members manage roster assignments" on public.roster_assignments;

create policy "everyone in the church sees roster assignments" on public.roster_assignments
  for select using (
    roster_id in (
      select r.id from public.rosters r
      join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
    )
  );

create policy "admin or team leader creates roster assignments" on public.roster_assignments
  for insert with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader updates roster assignments" on public.roster_assignments
  for update using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  )
  with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader deletes roster assignments" on public.roster_assignments
  for delete using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

-- Row Level Security: service_occurrences' new roster-only branch ----------
-- The existing service_type_id-based policies (from 0006) are untouched —
-- those church-wide dates stay Admin-only, generated behind the scenes by
-- the roster builder (via the service-role client, permission-checked in
-- the server action) rather than through a new RLS branch. Only the
-- roster-private branch (a Hotu's own extra one-off dates) needs new policy.

create policy "everyone in the church sees roster-only occurrences" on public.service_occurrences
  for select using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
    )
  );

create policy "admin or team leader creates roster-only occurrences" on public.service_occurrences
  for insert with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader updates roster-only occurrences" on public.service_occurrences
  for update using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  )
  with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader deletes roster-only occurrences" on public.service_occurrences
  for delete using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

-- Row Level Security: roster_notes ------------------------------------------

create policy "everyone in the church sees roster notes" on public.roster_notes
  for select using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
    )
  );

create policy "admin or team leader creates roster notes" on public.roster_notes
  for insert with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader updates roster notes" on public.roster_notes
  for update using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  )
  with check (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

create policy "admin or team leader deletes roster notes" on public.roster_notes
  for delete using (
    roster_id in (
      select r.id from public.rosters r join public.teams t on t.id = r.team_id
      where t.church_id = public.current_church_id()
        and (public.is_church_admin() or public.is_team_leader(t.id))
    )
  );

-- Respond to my own assignment ----------------------------------------------
-- A plain team member has no write access to roster_assignments (see above —
-- only Admin/leader do). This function is the one narrow exception: it lets
-- someone flip the response on their OWN assignment row, and nothing else
-- (not the person, not the position, not anyone else's row). SECURITY
-- DEFINER so it can bypass the leader-only RLS above; the ownership check
-- inside does the actual gatekeeping — same shape as is_team_leader().

create or replace function public.respond_to_assignment(p_assignment_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_auth_id uuid;
begin
  if p_response not in ('accepted', 'declined', 'pending') then
    raise exception 'INVALID_RESPONSE';
  end if;

  select u.auth_user_id into v_owner_auth_id
  from public.roster_assignments ra
  join public.users u on u.id = ra.user_id
  where ra.id = p_assignment_id;

  if v_owner_auth_id is null or v_owner_auth_id <> auth.uid() then
    raise exception 'NOT_YOUR_ASSIGNMENT';
  end if;

  update public.roster_assignments set response = p_response where id = p_assignment_id;
end;
$$;

revoke all on function public.respond_to_assignment(uuid, text) from public;
grant execute on function public.respond_to_assignment(uuid, text) to authenticated;
