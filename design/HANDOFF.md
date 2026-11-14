# Studi redesign — implementation handoff

Stack: Next.js App Router · React · TypeScript · Tailwind · shadcn/ui · Supabase. No new data model, no paid APIs. New dependency: none required (`vaul` Drawer ships with shadcn; `lucide-react` already used; Geist via `next/font/google` or the `geist` package).

Reference files in this project:
- `Studi Dashboard Directions.dc.html`, direction **1b** (chosen) — dashboard desktop + iPhone
- `Studi Desktop.dc.html`, 2a–2h — Focus, Calendar, Subjects, Study room, Statistics, Progress, Study Planner, Settings
- `Studi Mobile.dc.html`, 3a–3f — Calendar, Tasks + sheet, Focus (dark), Together, Progress, More
- `Studi Design System.dc.html`, 4a–4d — tokens, components, motion

All names and numbers in the mockups are mock data.

---

## 1. Design tokens

### 1.1 CSS variables (`app/globals.css`)

Uses the shadcn variable convention (HSL-free hex works with Tailwind v4 `@theme`; on v3 use `rgb()` channels or keep hex with `theme.extend.colors`).

```css
:root {
  /* surfaces */
  --chrome: #F4EFEB;      /* app background, sidebar */
  --canvas: #FDFBFA;      /* main content card */
  --raised: #FFFFFF;      /* list tiles, dialogs, popovers */
  --sunken: #F4EFEB;      /* data tiles, inputs, segmented track */
  --hover: #EDE6E1;
  --hairline: #ECE5E1;
  /* text */
  --ink: #241C1F;
  --ink-2: #5E5357;
  --ink-3: #7A6E72;       /* lowest text tone (≥4.5:1 on canvas) */
  --ink-4: #B9AEB2;       /* icons, empty rings only — never text */
  /* accent (pink default) */
  --accent-soft: #F6D5DC; /* hero tiles, selected chips */
  --accent: #D98A9B;      /* rings, bars, dots (decorative) */
  --accent-ink: #A63D57;  /* buttons, links, active text (6:1 on white) */
  --accent-ink-hover: #8E3049;
  /* status */
  --success: #2F6E50; --success-soft: #E6F3EC; --live: #4E9E78;
  --warning: #8A5A12; --warning-soft: #FAF0DF; --away: #E0A84F;
  --danger:  #A1302C; --danger-soft: #FBE4E4;
  /* shape */
  --radius-xs: 6px; --radius-sm: 10px; --radius-md: 14px;
  --radius-lg: 20px; --radius-xl: 26px;
  --shadow-card: 0 1px 3px rgba(60,30,40,.08);
  --shadow-pop: 0 24px 50px -16px rgba(60,30,40,.35);
  --shadow-cta: 0 14px 30px -12px color-mix(in srgb, var(--accent-ink) 70%, transparent);
  --ease: cubic-bezier(.2,.8,.2,1);
}
.dark {
  --chrome: #171315; --canvas: #1F1A1C; --raised: #262022; --sunken: #2B2427;
  --hover: #332B2E; --hairline: #3A3034;
  --ink: #F3ECEE; --ink-2: #BDB1B5; --ink-3: #9C9094; --ink-4: #5E5357;
  --accent-soft: #3A2329; --accent: #E9A3B2;
  /* in dark, primary buttons use --accent bg with --ink-on-accent text */
  --ink-on-accent: #241C1F;
}
```

### 1.2 Accent variants

Set with `data-accent` on `<html>` (store in the existing `profiles`/preferences accent field; no schema change).

| accent | soft (light) | base | ink | soft (dark) | base (dark) |
|---|---|---|---|---|---|
| pink (default) | #F6D5DC | #D98A9B | #A63D57 | #3A2329 | #E9A3B2 |
| blue | #DCE8F6 | #7FA8D9 | #2F6497 | #1F2A36 | #9DBDE3 |
| sage | #DDEBE2 | #86B79B | #2F6E50 | #1E2B24 | #A3CBB3 |
| lavender | #E7E1F6 | #A99BDB | #5B4A99 | #272236 | #BDB2E6 |
| peach | #F8E0D2 | #E7A57F | #9A4F24 | #33251E | #EDBA9A |
| neutral | #E9E4E1 | #9C9094 | #4A3F43 | #2A2427 | #BDB1B5 |

```css
[data-accent="blue"] { --accent-soft:#DCE8F6; --accent:#7FA8D9; --accent-ink:#2F6497; --accent-ink-hover:#24507B; }
.dark[data-accent="blue"] { --accent-soft:#1F2A36; --accent:#9DBDE3; }
/* …repeat per accent */
```

Theme (light/dark/system): `next-themes` with `attribute="class"`, already the shadcn default.

### 1.3 Subject palette

Keep the 10 colors already stored on subjects. Derive tint and text per color with a lookup, not a DB change:

```ts
export const SUBJECT_TONES: Record<string, { dot: string; tint: string; text: string }> = {
  "#D46A80": { dot: "#D46A80", tint: "#FBE9EC", text: "#A23A55" }, // rose
  "#4C93C9": { dot: "#4C93C9", tint: "#E5F0F9", text: "#2B6896" }, // sky
  "#4E9E78": { dot: "#4E9E78", tint: "#E6F3EC", text: "#2F6E50" }, // mint
  "#8E7CCB": { dot: "#8E7CCB", tint: "#EFEBFA", text: "#5B4A99" }, // lilac
  "#E08A5B": { dot: "#E08A5B", tint: "#FBEBE1", text: "#9A4F24" }, // apricot
  "#6B7280": { dot: "#6B7280", tint: "#EEEFF1", text: "#3F4550" }, // slate
  "#D9706B": { dot: "#D9706B", tint: "#FBE7E5", text: "#A1302C" }, // coral
  "#C98A2E": { dot: "#C98A2E", tint: "#FAF0DF", text: "#8A5A12" }, // amber
  "#3E9C96": { dot: "#3E9C96", tint: "#E1F2F0", text: "#226B66" }, // teal
  "#6A7BCF": { dot: "#6A7BCF", tint: "#E9ECFA", text: "#3E4FA0" }, // indigo
};
// map your existing stored hex values to the nearest key once.
// Dark mode: tint = color-mix(in srgb, dot 18%, var(--raised)); text = dot lightened 25%.
```

### 1.4 Typography

One family: **Geist** (`next/font/google` → `--font-sans`). Remove the serif display font. Numbers always `tabular-nums`.

| token | size/line | weight | tracking | use |
|---|---|---|---|---|
| display | 40/44 | 600 | -0.035em | dashboard greeting |
| title | 30/36 | 600 | -0.035em | page titles |
| section | 22/28 | 600 | -0.02em | section headings, drawer titles |
| tile-title | 16/22 | 600 | -0.01em | tile headings |
| body | 15/22 | 400 | 0 | task titles, paragraphs |
| nav / button | 14/20 | 500–600 | 0 | sidebar, buttons |
| label / meta | 13/18 (min 12.5) | 500 | 0 | metadata, chips |
| overline | 12.5/16 | 600 | 0.05em, uppercase | "UP NEXT" |
| stat | 34/38 | 600 | -0.04em | stat numbers |
| timer | 92 desktop / 76 mobile | 600 | -0.05em | Focus |

Never below 12px. Mobile body 15px minimum.

### 1.5 Spacing and layout

4px base: 4, 8, 12, 14 (tile gap), 16, 20, 24, 28 (page padding), 40.

---

## 2. App shell and responsive behavior

| breakpoint | width | navigation | content |
|---|---|---|---|
| mobile | < 768 | bottom tab bar (88px incl. safe area): Today, Calendar, **Focus** (raised 48px centre), Tasks, More | single column, 16–20px gutters, sheets for creation |
| tablet | 768–1279 | sidebar collapsed to 68px rail by default; expands over content | bento collapses 12 → 6 cols; side panels become sheets from right |
| laptop | 1280–1599 | 228px sidebar, collapsible (⌘\\) | 12-col bento, drawers inline (Subjects detail 420px) |
| large | ≥ 1600 | same | content max-width 1440, centred within canvas |

Shell structure: `chrome` background → sidebar (no border) → main content card inset 10px from the edges, radius 18, `canvas` background, `shadow-card`.

Focus and the live room auto-collapse the sidebar to the rail. In Focus "distraction-free" (⌘.), hide the rail as well.

Mobile: `env(safe-area-inset-*)` padding on the tab bar and sheets. The tab bar hides while a Focus session is running full screen. "More" holds Study Together, Subjects, Study Planner, Progress, Statistics, Friends, Settings.

### Component tree

```
app/(app)/layout.tsx
  <AppShell>
    <Sidebar>            desktop/tablet — NavGroup[], SearchTrigger(⌘K), UserMenu
    <MobileTabBar>       mobile — 5 tabs, FocusFab
    <main className="content-card"> {children} </main>
    <CommandMenu/>       shadcn Command — search + "jump to" + create
    <Toaster/>           sonner
components/ui/           shadcn primitives, restyled with tokens
components/studi/
  Tile                   variant: hero | data | list | context(color) ; radius xl
  StatStrip              4 numbers in one tile with dividers
  ProgressRing           size, stroke, value, trackColor
  SegmentBar             n segments, filled count, color (topic progress)
  SubjectChip            subject → dot + tint + text; selectable
  SubjectDot
  PresenceAvatar         initials/photo + live|away status
  AvatarStack
  CountdownBadge         days + label, subject tint
  TaskRow                Checkbox(round), title, subject, subtask count, priority
  QuickAddInput          parses @subject !priority date tokens (client-side regex)
  EventChip              kind: class | session-done | session-planned | exam | deadline | personal
  TimerDial              svg ring + numerals; props: remaining, total, phase, size
  PresetPicker           Sprint / Classic / Deep / Custom
  SoundTile              id, primary|mix|off; uses SOUNDSCAPE_META
  BadgeToken             unlocked | new | locked(progress)
  EmptyState             illustration slot (3 tiles), title, body, action
  ResponsiveDialog       Dialog ≥768, Drawer <768 (same form children)
```

---

## 3. Screens (desktop → mobile)

**Dashboard (1b).** Row 1: Up-next hero tile (7 cols, accent-soft) with inline duration dial + Start; Week focus tile (5 cols, bars per day, streak pill). Row 2: Today list tile (5), Countdown 2×2 tile (4), Friends live tile (3, sage). "Up next" picks the highest-priority open task linked to the nearest exam (fallback: first task due today). Mobile: hero with play ring, two half tiles (week, next exam), task list, friends strip.

**Focus (2a / 3c).** Hero timer tile + right column: subject chips, topic and task pickers, Rhythm (presets + Focus/Break sliders), Ambience (5 SoundTiles + primary/mix sliders). Bottom strip: today vs daily target, earlier sessions. Mobile: full-screen dark, sound row and controls in the lower third, tap ring to start/pause.

**Calendar (2b / 3a).** Toolbar: month/year, ‹ Today ›, Month/Week/Day/Agenda segmented, New. Left column: mini month (current week band), type filters, subject legend. Grid: 42px/hour, today column highlighted, red now-line. Drag to select → popover (type segmented, title, time, subject, reminder, Create ↵; "More options" opens the full ResponsiveDialog). Existing drag-reschedule and resize behavior is unchanged. Mobile: week strip with load dots → day timeline; long-press to create; FAB → sheet.

**Subjects (2c).** 2-col tile grid tinted per subject (icon, difficulty bars, SegmentBar, next exam). Selecting opens a 420px detail panel: header tile (Focus on this / Plan / Task), tabs Topics · Materials · Exams · Tasks, nested topics with status pill, next-exam ink card. "New subject" opens ResponsiveDialog (name, color swatches, difficulty 1–5 segmented, description).

**Study Together.** Hub (3d): invitation cards (accept/decline inline), Live rooms (timer + phase + avatars + Join), friends solo. Create room is a 3-step ResponsiveDialog: (1) name + visibility, (2) rhythm preset or custom sliders, max participants stepper, (3) chat & invite toggles. Live room (2d, dark by default): centred shared TimerDial, synced label, participant cards, chat panel locked during focus.

**Statistics (2e).** StatStrip, daily bars with goal line, by-subject stacked bar + list, 26-week heatmap (5 levels from accent), weekly trend line + 4 small facts. Range segmented: Week/Month/Semester/All. Charts: plain SVG or `recharts` (already common with shadcn charts).

**Progress (2f / 3e).** Single page (no tabs): streak hero (amber), weekly goal ring, challenges, achievements grid (filter: all/unlocked/in progress), opt-in leaderboard. If gamification is off in settings, render only weekly goal + statistics link.

**Study Planner (2g, new UI over existing data).** Backlog = topics not mastered for subjects with exams/deadlines in the next 21 days, estimated duration from preferences. Days show capacity (availability × session duration) and planned blocks. "Fill by due date" is deterministic: earliest deadline first, respecting daily capacity. "Add to calendar" writes planned study sessions through the existing calendar actions.

**Settings (2h).** Left section nav (Profile, Appearance, Focus & Pomodoro, Study rhythm, Privacy, Progress & badges, Account); one section per route segment `/settings/[section]`. Replace number inputs: presets + sliders (focus 5–90 step 5, short 1–30, long 5–45 step 5), long-break-after stepper 2–6, weekly goal slider 1–60h, rest/availability days as toggle chips. Autosave with 600ms debounce and a "Saved" status; remove per-card save buttons.

---

## 4. Interactions and states

| interaction | behavior |
|---|---|
| Sidebar collapse | ⌘\\ · 220ms width, labels fade, tooltips on rail icons |
| Command menu | ⌘K: search subjects/tasks/people, "New task/event/room", "Start focus" |
| Shortcuts | N new task · F start focus · G then D/C/T/S go to pages · Space pause · R reset · ⌘↵ finish & save · Esc exit |
| Task complete | round checkbox fills, strike, collapses after 1.2s; toast with Undo |
| Mobile swipe | right = complete, left = reschedule sheet (Today / Tomorrow / Pick date) |
| Start focus | from any "Start": navigate to /focus with subject/topic/task prefilled |
| Pomodoro ↔ Stopwatch | segmented; switching while running asks to save the current session first |
| Join room | Join → room opens with "Syncing…" for ≤1s, timer animates to server time |
| Friend request | toast with Accept; badge count on Friends nav |
| Achievement unlock | badge animates in the toast; Progress shows NEW until viewed |
| Weekly goal | ring completes, fills solid, single toast |
| Theme/accent | change root vars; 300ms color crossfade only |

Every interactive component needs default, hover, focus-visible, active, disabled, loading. Every data tile needs skeleton (after 300ms), empty (with action), error (inline retry) and populated states.

---

## 5. Accessibility

- Text uses `ink`, `ink-2`, `ink-3` only; `ink-4` and `accent` (base) are decorative. `accent-ink` on white ≥ 6:1; white on `accent-ink` ≥ 6:1. Dark primary buttons: `--ink-on-accent` on `--accent`.
- Focus ring: `0 0 0 2px var(--raised), 0 0 0 4px var(--accent)` on all focusables.
- Hit targets: 44×44 minimum on mobile (tab items, checkboxes padded), 32px on desktop.
- Color is never the only signal: event kinds have icons, presence has text, priority uses !/!!/!!!.
- `prefers-reduced-motion`: disable ring transitions, badge burst, sheet springs (fade only).
- Timer: `aria-live="polite"` announces phase changes only, not every second; `role="timer"`.
- Sliders: shadcn Slider (Radix) with `aria-valuetext="25 minutes"`.

---

## 6. Suggested implementation order

1. Tokens: globals.css variables, accent `data-accent`, Geist, remove serif. Update shadcn Button, Input, Select, Tabs (→ segmented), Switch, Checkbox (round variant), Slider, Dialog/Drawer, Sonner.
2. App shell: sidebar groups + collapse, content card, mobile tab bar + More page, ⌘K.
3. Shared components in `components/studi/`.
4. Dashboard (1b) with empty states.
5. Focus (desktop + mobile full screen).
6. Calendar restyle: toolbar, chips by kind, quick-create popover, mobile day view.
7. Tasks page + QuickAddInput + mobile swipe.
8. Subjects grid + detail panel + create dialog.
9. Study Together hub, create stepper, live room.
10. Settings sections + autosave.
11. Statistics, Progress.
12. Study Planner.
13. Dark-mode pass, reduced-motion pass, a11y audit.
