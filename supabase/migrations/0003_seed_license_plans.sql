-- WorshipFlow — Phase 1: seed the four starting license plans.
-- Run this in the Supabase SQL Editor AFTER 0001 and 0002.
-- Safe to re-run: it updates the label/duration if the plan_code already exists
-- instead of erroring out.

insert into public.license_plans (plan_code, label, duration_in_days) values
  ('trial_14', '14-Day Trial', 14),
  ('monthly', 'Monthly', 30),
  ('yearly', 'Yearly', 365),
  ('lifetime', 'Lifetime', null)
on conflict (plan_code) do update
  set label = excluded.label,
      duration_in_days = excluded.duration_in_days;
