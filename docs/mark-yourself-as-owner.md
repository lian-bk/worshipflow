# Marking your own account as Owner

This has to be done by hand, directly in the Supabase dashboard, on purpose —
the app's normal screens can never flip this switch for anyone. That's what
stops a church admin from ever promoting themselves (or anyone) to Owner.

You only do this once, for your own account.

## Steps

1. Register a church normally through the app first (see the main
   instructions for the test key), using **your own email** — this creates
   your `auth.users` row and matching `public.users` row. It's fine that this
   temporarily makes you an Admin of a "church" — you'll detach yourself from
   it in step 4 below if you'd rather not keep it.

   (If you'd rather not register a real church at all, you can skip to step 2
   and create a bare login instead — see the note at the bottom.)

2. In the Supabase dashboard, go to **Table Editor** (left sidebar) → select
   the **`users`** table (under the `public` schema).

3. Find the row with your email address. Click into the **`is_owner`**
   column for that row and change it from `false` to `true`. Press Enter /
   click away to save.

4. (Optional but recommended) In that same row, clear the **`church_id`**
   column back to empty/null, and set **`is_church_admin`** back to `false`.
   The Owner account isn't meant to belong to any single church — Section 2
   of the build guide describes the Owner as sitting above all churches, not
   inside one.

5. Log out of WorshipFlow and log back in. Your sidebar should now say "App
   Owner" instead of a church name (see `src/app/dashboard/layout.tsx`).

That's it — there's no app screen that can undo this, so it stays safe from
here on. Phase 2 will build the actual Owner Console screen at `/owner`.

## If you'd rather not attach Owner to a real church registration

You can create a login without going through Register:

1. In Supabase, go to **Authentication** → **Users** → **Add user** →
   create a user with your email and a password (tick "Auto Confirm User").
2. Go to **Table Editor** → **`users`** table → **Insert row**: set `id` to
   the new auth user's UUID (copy it from the Authentication page), `email`
   to your email, leave `church_id` empty, and set `is_owner` to `true`.
3. Log in with that email/password at `/login`.
