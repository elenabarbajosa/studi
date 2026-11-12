"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";

import {
  addOnboardingSubject,
  advanceOnboardingToPreferences,
  finishOnboarding,
  removeOnboardingSubject,
  saveOnboardingPersonalize,
  setOnboardingStep,
  skipOnboarding,
  type ActionState,
} from "@/actions/onboarding";
import { Brand } from "@/components/shared/brand";
import { useAccent } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCENT_COLORS,
  ACCENT_META,
  APPEARANCE_MODES,
  type AccentColor,
  type AppearanceMode,
} from "@/lib/theme";
import {
  BREAK_DURATION_OPTIONS,
  DEFAULT_WEEKDAY_AVAILABILITY,
  SESSION_DURATION_OPTIONS,
  SUBJECT_COLOR_META,
  SUBJECT_COLORS,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type SubjectColor,
  type WeekdayAvailability,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";
import type { Profile, StudyPreferences, Subject } from "@/types/database";

type OnboardingWizardProps = {
  profile: Profile;
  subjects: Subject[];
  preferences: StudyPreferences | null;
};

const emptyState: ActionState = {};

export function OnboardingWizard({
  profile,
  subjects,
  preferences,
}: OnboardingWizardProps) {
  const step = Math.min(Math.max(profile.onboarding_step || 1, 1), 3);
  const { setTheme, theme } = useTheme();
  const { accent, setAccent } = useAccent();
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(
    profile.display_name || profile.username,
  );
  const [appearance, setAppearance] = useState<AppearanceMode>(
    profile.appearance,
  );
  const [accentColor, setAccentColor] = useState<AccentColor>(
    profile.accent_color,
  );

  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState<SubjectColor>("pink");
  const [subjectDifficulty, setSubjectDifficulty] = useState<string>("");

  const [availability, setAvailability] = useState<WeekdayAvailability>(
    preferences?.weekday_availability ?? DEFAULT_WEEKDAY_AVAILABILITY,
  );
  const [sessionDuration, setSessionDuration] = useState(
    String(preferences?.session_duration_minutes ?? 50),
  );
  const [breakDuration, setBreakDuration] = useState(
    String(preferences?.break_duration_minutes ?? 10),
  );
  const [weeklyGoal, setWeeklyGoal] = useState(
    preferences?.weekly_goal_hours != null
      ? String(preferences.weekly_goal_hours)
      : "",
  );

  const [personalizeState, personalizeAction, personalizePending] =
    useActionState(saveOnboardingPersonalize, emptyState);
  const [subjectState, subjectAction, subjectPending] = useActionState(
    addOnboardingSubject,
    emptyState,
  );
  const [finishState, finishAction, finishPending] = useActionState(
    finishOnboarding,
    emptyState,
  );

  const previewAppearance = theme ?? appearance;

  const steps = useMemo(
    () => [
      { id: 1, label: "Personalize" },
      { id: 2, label: "Subjects" },
      { id: 3, label: "Study rhythm" },
    ],
    [],
  );

  function goToStep(next: 1 | 2 | 3) {
    startTransition(async () => {
      const result = await setOnboardingStep(next);
      if (result.error) toast.error(result.error);
    });
  }

  function handleSkip() {
    startTransition(async () => {
      const result = await skipOnboarding();
      if (result.error) toast.error(result.error);
    });
  }

  function applyAppearance(next: AppearanceMode) {
    setAppearance(next);
    setTheme(next);
  }

  function applyAccent(next: AccentColor) {
    setAccentColor(next);
    setAccent(next);
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Brand href="/dashboard" size="sm" />
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={handleSkip}
        >
          Skip for now
        </Button>
      </div>

      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Welcome to Studi</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight md:text-4xl">
          Set up your study space
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Three short steps. You can skip anytime and finish later from Settings.
        </p>
      </div>

      <ol className="mb-8 flex gap-2">
        {steps.map((item) => (
          <li key={item.id} className="flex-1">
            <div
              className={cn(
                "rounded-full px-3 py-2 text-center text-xs font-medium",
                step === item.id
                  ? "bg-primary text-primary-foreground"
                  : step > item.id
                    ? "bg-brand-soft text-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {item.id}. {item.label}
            </div>
          </li>
        ))}
      </ol>

      <div className="studi-panel flex-1 p-6 sm:p-8">
        {step === 1 ? (
          <form action={personalizeAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <input type="hidden" name="appearance" value={appearance} />
            <input type="hidden" name="accent_color" value={accentColor} />

            <div>
              <p className="mb-3 text-sm font-medium">Appearance</p>
              <div className="flex flex-wrap gap-2">
                {APPEARANCE_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyAppearance(mode)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm capitalize",
                      appearance === mode
                        ? "border-primary bg-brand-soft"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Accent</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => applyAccent(color)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left",
                      accentColor === color
                        ? "border-primary bg-brand-soft"
                        : "border-border hover:bg-muted/60",
                    )}
                  >
                    <span
                      className="size-4 rounded-full"
                      style={{ background: ACCENT_META[color].swatch }}
                    />
                    <span className="text-sm">{ACCENT_META[color].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={cn(
                "rounded-2xl border p-5 transition-colors",
                previewAppearance === "dark" ? "dark bg-zinc-900 text-zinc-50" : "bg-background",
              )}
              data-accent={accentColor}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Live preview
              </p>
              <p className="mt-2 font-display text-2xl tracking-tight">
                Hello, {displayName || "student"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {appearance} · {ACCENT_META[accentColor].label}
              </p>
              <div className="mt-4 inline-flex rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                Continue studying
              </div>
            </div>

            {personalizeState.error ? (
              <p className="text-sm text-destructive" role="alert">
                {personalizeState.error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={personalizePending} className="gap-2">
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl tracking-tight">
                Add your subjects
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with the courses you are taking this term. You can edit
                them later.
              </p>
            </div>

            <ul className="space-y-2">
              {subjects.length === 0 ? (
                <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No subjects yet — add at least one, or continue and add later.
                </li>
              ) : (
                subjects.map((subject) => (
                  <li
                    key={subject.id}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{
                        background: SUBJECT_COLOR_META[subject.color].swatch,
                      }}
                    />
                    <span className="flex-1 text-sm font-medium">
                      {subject.name}
                    </span>
                    {subject.difficulty ? (
                      <span className="text-xs text-muted-foreground">
                        Difficulty {subject.difficulty}/5
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await removeOnboardingSubject(
                            subject.id,
                          );
                          if (result.error) toast.error(result.error);
                        });
                      }}
                      aria-label={`Remove ${subject.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))
              )}
            </ul>

            <form action={subjectAction} className="space-y-4 rounded-xl bg-muted/40 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="name">Subject name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Organic Chemistry"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    value={subjectDifficulty}
                    onChange={(e) => setSubjectDifficulty(e.target.value)}
                    className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Optional</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input type="hidden" name="color" value={subjectColor} />
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSubjectColor(color)}
                    className={cn(
                      "size-7 rounded-full border-2",
                      subjectColor === color
                        ? "border-foreground"
                        : "border-transparent",
                    )}
                    style={{ background: SUBJECT_COLOR_META[color].swatch }}
                    aria-label={SUBJECT_COLOR_META[color].label}
                  />
                ))}
              </div>

              {subjectState.error ? (
                <p className="text-sm text-destructive">{subjectState.error}</p>
              ) : null}

              <Button
                type="submit"
                variant="outline"
                disabled={subjectPending || !subjectName.trim()}
                className="gap-2"
              >
                <Plus className="size-4" />
                Add subject
              </Button>
            </form>

            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                disabled={isPending}
                onClick={() => goToStep(1)}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await advanceOnboardingToPreferences();
                    if (result.error) toast.error(result.error);
                  });
                }}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <form action={finishAction} className="space-y-6">
            <div>
              <h2 className="font-display text-2xl tracking-tight">
                Study preferences
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell Studi when you usually study. Everything is editable later
                in Settings.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Typical availability</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className={cn(
                      "cursor-pointer rounded-xl border px-3 py-2 text-sm",
                      availability[day]
                        ? "border-primary bg-brand-soft"
                        : "border-border",
                    )}
                  >
                    <input
                      type="checkbox"
                      name={`day_${day}`}
                      checked={availability[day]}
                      onChange={(e) =>
                        setAvailability((prev) => ({
                          ...prev,
                          [day]: e.target.checked,
                        }))
                      }
                      className="sr-only"
                    />
                    {WEEKDAY_LABELS[day]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session_duration_minutes">
                  Session duration
                </Label>
                <select
                  id="session_duration_minutes"
                  name="session_duration_minutes"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {SESSION_DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins} minutes
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="break_duration_minutes">Break duration</Label>
                <select
                  id="break_duration_minutes"
                  name="break_duration_minutes"
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                >
                  {BREAK_DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 0 ? "No break" : `${mins} minutes`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weekly_goal_hours">
                Weekly study goal (hours, optional)
              </Label>
              <Input
                id="weekly_goal_hours"
                name="weekly_goal_hours"
                type="number"
                min={0}
                max={80}
                step={0.5}
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value)}
                placeholder="e.g. 12"
              />
            </div>

            {finishState.error ? (
              <p className="text-sm text-destructive">{finishState.error}</p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                disabled={isPending || finishPending}
                onClick={() => goToStep(2)}
              >
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button type="submit" disabled={finishPending}>
                {finishPending ? "Saving…" : "Finish setup"}
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Using accent {accent} · preview mode {previewAppearance}
      </p>
    </div>
  );
}
