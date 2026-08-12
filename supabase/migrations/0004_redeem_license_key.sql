-- WorshipFlow — Phase 1: the "redeem a product key" function.
-- Run this in the Supabase SQL Editor AFTER 0001, 0002, and 0003.
--
-- This does the whole "Register Your Church" step in one atomic database
-- transaction (check key -> create church -> mark key active -> make the
-- registering person Admin), so nothing gets half-done if something fails
-- partway through, and two people can't both redeem the same key at the
-- same instant (the "for update" line below locks the key's row while it
-- checks it).
--
-- SECURITY DEFINER means this function runs with the permissions of the
-- person who created it (the database owner), not the caller — that's what
-- lets it write to license_keys and users even though ordinary logged-in
-- users aren't allowed to touch those tables directly. Only the server
-- (using the service_role key, from a Next.js Server Action) is granted
-- permission to call it — never the browser.

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

  insert into public.users (id, church_id, email, full_name, is_owner, is_church_admin)
  values (p_user_id, v_church_id, p_user_email, p_full_name, false, true)
  on conflict (id) do update
    set church_id = excluded.church_id,
        full_name = excluded.full_name,
        is_church_admin = true;

  return query select v_church_id;
end;
$$;

revoke all on function public.redeem_license_key(text, text, text, text, uuid, text, text) from public;
grant execute on function public.redeem_license_key(text, text, text, text, uuid, text, text) to service_role;
