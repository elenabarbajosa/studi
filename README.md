# Studi

A calm, Notion-inspired study and productivity web app for university students.

**Phase 1** covers the product foundation: design system, authentication, private profiles, theme preferences, dashboard shell, and empty states for upcoming modules.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide
- Supabase Auth + PostgreSQL (RLS)
- Vercel-compatible deployment

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without Supabase keys the landing page still runs. Auth and dashboard routes need a configured project.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Put them in `.env.local` (never commit real values; never expose the **service role** key as `NEXT_PUBLIC_*`).
4. In the Supabase SQL editor, run:

   [`supabase/migrations/001_profiles.sql`](supabase/migrations/001_profiles.sql)

   This creates:
   - `profiles` table with unique usernames
   - appearance + accent preference columns
   - trigger to create a profile on signup
   - Row Level Security so users only access their own profile

5. **Authentication → Providers**
   - Enable **Email** (password)
   - Optionally enable **Google** and add OAuth client ID/secret from Google Cloud Console
6. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000` (or your Vercel URL in production)
   - Redirect URLs: `http://localhost:3000/auth/callback` and your production callback URL

## Scripts

```bash
npm run dev      # local development
npm run lint     # ESLint
npm run build    # production build
npx tsc --noEmit # TypeScript check
```

## Phase 1 routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/login`, `/signup` | Email/password + Google OAuth |
| `/auth/callback` | OAuth / email confirmation exchange |
| `/dashboard` | Authenticated home |
| `/calendar`, `/subjects`, `/planner`, `/focus`, `/friends`, `/study-together`, `/statistics` | Empty states |
| `/settings` | Profile, appearance, accent |
| `/onboarding` | Fallback profile creation if the signup trigger did not run |

## Design tokens

- Appearance: light / dark / system (`next-themes`)
- Accents: pink (default), blue, green, purple, peach, neutral via `data-accent` on `<html>`
- Tokens live in `src/app/globals.css`; accent metadata in `src/lib/theme.ts`

## Privacy notes

- Profiles are **private** in Phase 1 (owner-only RLS).
- Later social features should add explicit, least-privilege policies — do not open profiles globally without a design pass.

## Deploying to Vercel

1. Push the repo and import it in Vercel.
2. Add the same `NEXT_PUBLIC_SUPABASE_*` (and optional `NEXT_PUBLIC_SITE_URL`) env vars.
3. Update Supabase redirect URLs to the production domain.
4. Deploy.
