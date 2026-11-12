# Studi

A calm, Notion-inspired study and productivity web app for university students.

**Phase 1** covers authentication, private profiles, and theme preferences.  
**Phase 2** adds onboarding, subjects, topics/subtopics, materials, and study preferences.  
**Phase 3** adds the academic calendar, assessments, tasks/subtasks, study sessions, and a live dashboard agenda.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide
- Supabase Auth + PostgreSQL (RLS)
- Vercel-compatible deployment

## Quick start

```bash
npm install
cp .env.example .env.local
# Fill in Supabase values, then:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Create `.env.local` (gitignored) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- Prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (current Supabase dashboard name).
- Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still accepted as a fallback.
- Never put the **service role** key in `NEXT_PUBLIC_*` variables.

## Manual Supabase setup (required)

These steps are **not** completed by the app automatically.

### 1. Run SQL migrations

In the Supabase dashboard → **SQL Editor**, run in order:

1. [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql)  
   Creates `profiles`, unique usernames, theme columns, signup trigger, and RLS.
2. [`supabase/migrations/002_username_availability.sql`](supabase/migrations/002_username_availability.sql)  
   Required for signup username checks. Safe if already included at the end of `001`.
3. [`supabase/migrations/003_phase2_subjects.sql`](supabase/migrations/003_phase2_subjects.sql)  
   **Required for Phase 2.** Adds onboarding columns, `study_preferences`, `subjects`, `topics`, `materials`, and RLS. Existing Phase 1 profiles are marked `onboarding_status = skipped` so they are not forced through the wizard.
4. [`supabase/migrations/004_phase3_calendar.sql`](supabase/migrations/004_phase3_calendar.sql)  
   **Required for Phase 3.** Adds `assessments`, `tasks`, `subtasks`, `calendar_events`, `study_sessions`, ownership triggers, indexes, and RLS.

Confirm in **Table Editor** that these tables exist with RLS enabled: `profiles`, `study_preferences`, `subjects`, `topics`, `materials`, `assessments`, `tasks`, `subtasks`, `calendar_events`, `study_sessions`.

### 2. Auth providers & URLs

In **Authentication → Providers**:

- Enable **Email** (email + password).
- Optionally enable **Google** and add Google Cloud OAuth credentials.

In **Authentication → URL configuration**:

- **Site URL:** `http://localhost:3000` (production URL later)
- **Redirect URLs** (add all that apply):
  - `http://localhost:3000/auth/callback`
  - `https://YOUR_PRODUCTION_DOMAIN/auth/callback`

### 3. Email confirmation (recommended)

In **Authentication → Sign In / Methods** (or Providers → Email):

- Keep **Confirm email** enabled for production-like testing, **or**
- Disable it temporarily for local speed (signup then signs in immediately).

Confirmation and password-reset emails use Supabase’s email templates. For local testing, open links from the Supabase **Authentication → Users** email logs or your inbox.

### 4. Restart the Next.js app

After changing `.env.local`, restart `npm run dev`.

## Auth features

| Flow | Route / action |
| --- | --- |
| Sign up | `/signup` |
| Sign in | `/login` |
| Sign out | Settings → Sign out |
| Email confirmation | `/auth/callback` |
| Forgot password | `/forgot-password` |
| Reset password | `/reset-password` (via email link) |
| Google OAuth | Login/signup button (requires Google provider) |
| Theme prefs | Saved on `profiles.appearance` + `profiles.accent_color` |

Protected app routes redirect to `/login` when there is no session. Sessions are refreshed in `src/proxy.ts`.

## Phase 2 features

| Feature | Route |
| --- | --- |
| Onboarding (3 steps, skippable) | `/onboarding` |
| Subjects list + create | `/subjects` |
| Subject detail (overview, topics, materials, progress) | `/subjects/[id]` |
| Study preferences | Settings |

Onboarding progress is stored on `profiles.onboarding_status` / `onboarding_step`. Incomplete (`pending` / `in_progress`) users are redirected to `/onboarding`. Skipped users can resume from Settings.

## Phase 3 features

| Feature | Route |
| --- | --- |
| Interactive calendar (month / week / day, DnD, resize) | `/calendar` |
| Tasks (Today / Upcoming / All / Completed) | `/tasks` |
| Exams & deadlines from subject pages | `/subjects/[id]` → Exams & deadlines |
| Dashboard agenda (real user data) | `/dashboard` |

Create exams, personal events, and study sessions from the calendar (click a slot). Drag to reschedule; failed saves revert the event visually. Study sessions stay `planned` until you change status — they are not auto-completed when time passes.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Test plan: two separate accounts

1. Apply both SQL migrations and set redirect URLs as above.
2. Restart `npm run dev`.
3. **Browser A / Account 1**
   - Open `/signup`
   - Register with a unique email + username (e.g. `alice_studi`)
   - Confirm email if required, then open `/dashboard`
   - Go to **Settings**, change accent + appearance, reload — preferences should stick
4. **Browser B or private window / Account 2**
   - Register another user (e.g. `bob_studi`)
   - Confirm you land on your own dashboard with `@bob_studi`
5. **Privacy check**
   - As Alice, you should never see Bob’s profile data in Settings
   - Try claiming Bob’s username in Alice’s Settings → should fail as taken
6. **Password reset**
   - From `/forgot-password`, request a reset for Account 1
   - Open the email link → set a new password → land on dashboard

## Deploying to Vercel

1. Add the same `NEXT_PUBLIC_SUPABASE_*` and `NEXT_PUBLIC_SITE_URL` env vars.
2. Update Supabase Site URL + redirect allow list to the production domain.
3. Deploy.
