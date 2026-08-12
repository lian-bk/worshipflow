-- Run this in Supabase SQL Editor any time you want a fresh test product key.
-- Change 'WFLW-TEST-0001' to any code you like — it just has to be unique.

insert into public.license_keys (key_code, plan_code, issued_to_email)
values ('WFLW-TEST-0001', 'trial_14', 'test-church@example.com');

-- To check a key's current status:
-- select key_code, plan_code, status, church_id, activated_at, expires_at
-- from public.license_keys
-- where key_code = 'WFLW-TEST-0001';
