# Studi

A calm, Notion-inspired study and productivity web app for university students.

**Phase 1** covers authentication, private profiles, and theme preferences.  
**Phase 2** adds onboarding, subjects, topics/subtopics, materials, and study preferences.  
**Phase 3** adds the academic calendar, assessments, tasks/subtasks, study sessions, and a live dashboard agenda.  
**Phase 5** adds Focus Mode, Pomodoro, soundscapes, and study statistics.  
**Phase 6** adds friends, social profiles, privacy controls, and optional study presence.

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
5. [`supabase/migrations/005_avatars.sql`](supabase/migrations/005_avatars.sql)  
   **Required for profile pictures.** Adds avatar preference columns on `profiles`, creates the private `avatars` Storage bucket, and owner-only Storage RLS policies.
6. [`supabase/migrations/006_phase5_focus.sql`](supabase/migrations/006_phase5_focus.sql)  
   **Required for Focus Mode.** Extends `study_sessions` with focus metrics, adds `focus_active_sessions`, Pomodoro/soundscape columns on `study_preferences`, and RLS.
7. [`supabase/migrations/007_phase6_friends.sql`](supabase/migrations/007_phase6_friends.sql)  
   **Required for Friends.** Adds social preference columns, `friendships`, `friend_requests`, `user_blocks`, `user_presence`, discovery/social RPCs, avatar Storage SELECT for friends/public, and optional Realtime policies.
8. [`supabase/migrations/008_repair_studi_friends.sql`](supabase/migrations/008_repair_studi_friends.sql)  
   Restores Phase 6 RPCs if an earlier partial `007` deploy left them missing.
9. [`supabase/migrations/009_phase7_study_together.sql`](supabase/migrations/009_phase7_study_together.sql)  
   **Required for Study Together.** Rooms, members, invite token hashes, authoritative timer state, chat, `study_together` session source, and Realtime Presence policies.

Confirm in **Table Editor** that these tables exist with RLS enabled, including `study_rooms`, `study_room_members`, `study_room_invitations`, `study_room_timer_state`, `study_room_messages`.

Confirm in **Storage** that the `avatars` bucket exists and is **private** (not public).

If `006` or `009` errors on using a newly added enum value in the same transaction, run the `alter type … add value` lines at the top of the file first, then re-run the rest.

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

## Profile pictures & avatars

| Feature | Details |
| --- | --- |
| Upload / crop / zoom | Settings → Profile picture |
| Preference model | `custom` · `google` · `initials` |
| Storage | Private `avatars` bucket; signed URLs for display |
| Google OAuth | Picture stored in `google_avatar_url`; never overwrites a custom upload |
| Visibility column | `avatar_visibility` defaults to `private` (friends/public prepared for later) |

Uploads are validated by MIME magic bytes and capped at 5 MB. Cropped images are resized to 512×512 WebP/JPEG before upload. Paths look like `{user_id}/{uuid}.webp` so browsers do not keep stale caches.

## Phase 5 — Focus & statistics

| Feature | Route |
| --- | --- |
| Pomodoro + stopwatch Focus Mode | `/focus` |
| Distraction-free / fullscreen-style view | Focus page → Focus view |
| Study statistics (real focus seconds only) | `/statistics` |
| Pomodoro + soundscape preferences | Settings → Focus & Pomodoro |

### Timer architecture

- Pure engine in `src/lib/focus/timer-engine.ts` (timestamp-based; Study Together can later drive the same state from a server clock).
- Live recovery via `localStorage` + `focus_active_sessions` heartbeats.
- Gaps longer than 5 minutes pause the timer instead of counting unattended time.
- Finished sessions save to `study_sessions` with `source = 'focus'` and idempotent `client_session_id`.

### Soundscapes (licensing)

All ambience is **procedurally generated in the browser** with the Web Audio API (`src/lib/focus/soundscapes.ts`):

| Id | Implementation | License |
| --- | --- | --- |
| `silence` | No audio | n/a |
| `white_noise` | Generated noise buffer | Original code |
| `rain` | Filtered noise + sparse droplets | Original code |
| `cafe` | Brown-noise texture | Original code |
| `forest` | Band-passed texture + light chirps | Original code |

No third-party sample packs are bundled. Playback starts only after a user click (autoplay-safe). To swap in recorded libraries later, place licensed files under `public/sounds/` and document source + license here.

## Phase 6 — Friends & social profiles

| Feature | Route |
| --- | --- |
| Friends board (lists, search, requests, studying now) | `/friends` |
| Social profile by username | `/u/[username]` |
| Privacy & discovery settings | Settings → Privacy & discovery |

### Security model

- `profiles` RLS stays **owner-only**. Username search and social profile reads go through security-definer RPCs (`search_discoverable_profiles`, `get_social_profile`, `list_my_friends`) that return only allowed fields.
- Friendships are mutual ordered pairs (`user_low`, `user_high`). Accept/remove/block run as atomic RPCs.
- Email, calendar events, exams, tasks, notes, and grades are never exposed through social RPCs.
- Custom avatars stay in a private Storage bucket; the app mints short-lived signed URLs server-side when visibility allows.

### Study presence & Realtime

- Focus Mode upserts `user_presence` on start/phase change and ~60s heartbeats (never per-second). Rows older than 3 minutes are treated as offline.
- Friends page optionally listens to `postgres_changes` on `user_presence` (RLS enforced) and refreshes at most every 15s.
- Migration also attempts private Presence policies on topic `friends-presence` for a future channel. In the Supabase dashboard:
  1. **Database → Replication**: enable Realtime for `user_presence` if the publication step was skipped.
  2. **Realtime**: keep public/anonymous channel access disabled; only authenticated clients should join private topics.
  3. Do not broadcast goals, subjects, timers, or academic IDs on Presence payloads.

## Phase 7 — Study Together

| Feature | Route |
| --- | --- |
| Study Together hub | `/study-together` |
| Room (sync timer + presence + chat) | `/study-together/[roomId]` |
| Invite link join | `/study-together/join?token=…` |

### Timer & host policy

- Shared Pomodoro state lives in `study_room_timer_state` (server timestamps + monotonic `revision`).
- Clients render remaining time from `phase_ends_at` with a clock offset; no per-second network ticks.
- `reconcile_room_timer` advances an expired phase idempotently when an authorized member reads or the host commands. **Unattended rooms do not auto-advance without a client (or a future cron).**
- Host leave transfers to the longest-standing active member; alone-host leave ends the room. Presence disconnect does **not** remove membership or host role.

### Realtime configuration

1. Enable Realtime for `study_room_timer_state` and `study_room_messages`.
2. Disable **Allow public access** on Realtime channels so Presence topics require authorization.
3. Presence topic pattern: `study-room:<room_uuid>` (private). Membership is checked via `is_active_room_member`.

### Chat retention

Messages persist until soft-deleted by the sender or purged after **7 days** (manual/cron). Focus phases hide chat in the UI; members can still access history when chat is enabled.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
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
