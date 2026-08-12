# WorshipFlow

Church presentation and team scheduling, licensed by product key, one church at a time.

This is a Next.js (TypeScript, App Router) app backed by Supabase (database,
auth, storage, realtime).

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

You'll need a `.env.local` file with your Supabase project's URL and keys —
see `.env.local.example` for the three values it needs. `.env.local` is
gitignored, so it never gets pushed to GitHub.

## Database setup

In the Supabase dashboard, open **SQL Editor** and run these files in order,
once, on a fresh project:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_functions_and_rls.sql`
3. `supabase/migrations/0003_seed_license_plans.sql`
4. `supabase/migrations/0004_redeem_license_key.sql`

To create a test product key afterward, run `docs/create-test-key.sql`.

## Other docs

- `docs/mark-yourself-as-owner.md` — the one manual, dashboard-only step to
  mark your own account as the app Owner.

## Project structure (plain English)

- `src/app/register` — the "Register Your Church" page (needs a product key).
- `src/app/login` — the normal returning-user login page.
- `src/app/dashboard` — everything behind login: sidebar + placeholder pages
  for Teams, Roster, Service Planner, Library, My Schedule, Settings.
- `src/lib/supabase` — the three ways the app talks to Supabase (from the
  browser, from a logged-in server request, and as the privileged admin
  client used only for registration).
- `supabase/migrations` — the database schema, security rules, and seed data.
