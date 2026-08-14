-- Phase 6: shareable live-show links (Stage Display / Clean Stream / Projector
-- browser link), the same idea as ProPresenter's "Network" outputs. One row
-- per service occurrence holds the current on-screen state; the church
-- Admin's Show page keeps it updated as they click through slides, and
-- anyone with the link (no login needed) sees it live via Supabase Realtime.
create table if not exists public.live_show_state (
  occurrence_id uuid primary key references public.service_occurrences (id) on delete cascade,
  church_id uuid not null references public.churches (id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  church_name text not null default '',
  tagline text not null default '',
  payload jsonb not null default '{"type":"blank"}'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists live_show_state_token_idx on public.live_show_state (token);

alter table public.live_show_state enable row level security;

-- Only the church's own Admin(s) can read/write their occurrence's row
-- through the normal signed-in app. Public link viewers never use this
-- policy at all — they're served by a Route Handler using the service-role
-- key (src/lib/supabase/admin.ts), which looks the row up by token and
-- bypasses RLS on purpose, the same pattern already used elsewhere in this
-- app for pre-login actions.
create policy "admins manage own church live state" on public.live_show_state
  for all
  using (
    church_id in (select church_id from public.users where id = auth.uid() and is_church_admin = true)
  )
  with check (
    church_id in (select church_id from public.users where id = auth.uid() and is_church_admin = true)
  );
