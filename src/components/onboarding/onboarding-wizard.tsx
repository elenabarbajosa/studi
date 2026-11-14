"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
} from "lucide-react";

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
import { Field, NativeSelect } from "@/components/studi/form-controls";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { Input } from "@/components/ui/input";
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
  const { setTheme } = useTheme();
  const { setAccent } = useAccent();
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

  const steps = useMemo(
    () => [
      { id: 1, label: "Personalize" },
      { id: 2, label: "Subjects" },
      { id: 3, label: "Rhythm" },
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
    <div className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col px-4 py-8 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,color-mix(in_srgb,var(--accent-soft)_90%,transparent),transparent)]"
      />

      <div className="mb-8 flex items-center justify-between gap-4">
        <Brand href="/dashboard" size="sm" />
        <button
          type="button"
          className={cn(softPillClass, "bg-transparent")}
          disabled={isPending}
          onClick={handleSkip}
        >
          Skip for now
        </button>
      </div>

      <div className="mb-6">
        <p className="text-[13px] font-semibold tracking-[0.04em] text-accent-text uppercase">
          Welcome to Studi
        </p>
        <h1 className="mt-1 text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[34px]">
          Set up your study space
        </h1>
        <p className="mt-2 max-w-xl text-[14.5px] text-ink-2">
          Three short steps. Skip anytime and finish later from Settings.
        </p>
      </div>

      <ol className="mb-6 flex gap-2" aria-label="Onboarding progress">
        {steps.map((item) => {
          const done = step > item.id;
          const active = step === item.id;
          return (
            <li key={item.id} className="flex-1">
              <div
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold",
                  active
                    ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                    : done
                      ? "bg-accent-soft text-accent-text"
                      : "bg-sunken text-ink-3",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : null}
                <span className="hidden min-[420px]:inline">
                  {item.id}. {item.label}
                </span>
                <span className="min-[420px]:hidden">{item.id}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex-1 rounded-[26px] bg-raised p-5 shadow-[0_0_0_1px_var(--hairline)] sm:p-8">
        {step === 1 ? (
          <form action={personalizeAction} className="flex flex-col gap-6">
            <Field label="What should we call you?" htmlFor="display_name">
              <Input
                id="display_name"
                name="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </Field>

            <input type="hidden" name="appearance" value={appearance} />
            <input type="hidden" name="accent_color" value={accentColor} />

            <div>
              <p className="mb-3 text-[14px] font-medium text-ink">Appearance</p>
              <div className="grid grid-cols-3 gap-2">
                {APPEARANCE_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => applyAppearance(mode)}
                    className={cn(
                      "rounded-[16px] px-3 py-3 text-[13.5px] font-semibold capitalize outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                      appearance === mode
                        ? "bg-accent-soft text-accent-text shadow-[0_0_0_1.5px_var(--accent)]"
                        : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
                    )}
                    aria-pressed={appearance === mode}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[14px] font-medium text-ink">Accent</p>
              <div className="flex flex-wrap gap-3">
                {ACCENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => applyAccent(color)}
                    className="flex flex-col items-center gap-1.5 outline-none focus-visible:rounded-full focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                    aria-pressed={accentColor === color}
                    aria-label={ACCENT_META[color].label}
                  >
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full",
                        accentColor === color
                          ? "shadow-[0_0_0_3px_var(--raised),0_0_0_5px_var(--accent-ink)]"
                          : "shadow-[0_0_0_1px_rgba(0,0,0,.08)]",
                      )}
                      style={{ background: ACCENT_META[color].swatch }}
                    >
                      {accentColor === color ? (
                        <Check className="size-4 text-white" aria-hidden />
                      ) : null}
                    </span>
                    <span className="text-[12px] font-medium text-ink-2">
                      {ACCENT_META[color].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] bg-accent-soft px-5 py-4">
              <p className="text-[12px] font-semibold tracking-[0.05em] text-accent-text uppercase">
                Preview
              </p>
              <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-ink">
                Hello, {displayName || "student"}
              </p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {appearance} · {ACCENT_META[accentColor].label}
              </p>
            </div>

            {personalizeState.error ? (
              <p className="text-[13.5px] font-medium text-danger" role="alert">
                {personalizeState.error}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={personalizePending}
                className={cn(primaryPillClass, "gap-2")}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
                Add your subjects
              </h2>
              <p className="mt-1 text-[14px] text-ink-2">
                Start with the courses you’re taking this term. Exams can wait —
                add them later from Subjects.
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {subjects.length === 0 ? (
                <li className="rounded-[18px] border border-dashed border-[color:var(--hairline)] px-4 py-8 text-center text-[14px] text-ink-3">
                  No subjects yet — add at least one, or continue and add later.
                </li>
              ) : (
                subjects.map((subject) => (
                  <li
                    key={subject.id}
                    className="flex items-center gap-3 rounded-[16px] bg-sunken px-3.5 py-2.5"
                  >
                    <span
                      className="size-3 rounded-full"
                      style={{
                        background: SUBJECT_COLOR_META[subject.color].swatch,
                      }}
                    />
                    <span className="flex-1 text-[14px] font-semibold text-ink">
                      {subject.name}
                    </span>
                    {subject.difficulty ? (
                      <span className="text-[12px] text-ink-3">
                        Difficulty {subject.difficulty}/5
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-ink-3 outline-none hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--accent)]"
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
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                ))
              )}
            </ul>

            <form
              action={subjectAction}
              className="flex flex-col gap-4 rounded-[20px] bg-sunken p-4"
            >
              <div className="grid gap-3 min-[640px]:grid-cols-[1fr_140px]">
                <Field label="Subject name" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Organic Chemistry"
                    required
                  />
                </Field>
                <Field label="Difficulty" htmlFor="difficulty" optional>
                  <NativeSelect
                    id="difficulty"
                    name="difficulty"
                    value={subjectDifficulty}
                    onChange={(e) => setSubjectDifficulty(e.target.value)}
                  >
                    <option value="">Optional</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <input type="hidden" name="color" value={subjectColor} />
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSubjectColor(color)}
                    className={cn(
                      "size-7 rounded-full outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]",
                      subjectColor === color
                        ? "shadow-[0_0_0_2px_var(--raised),0_0_0_3.5px_var(--ink)]"
                        : "",
                    )}
                    style={{ background: SUBJECT_COLOR_META[color].swatch }}
                    aria-label={SUBJECT_COLOR_META[color].label}
                    aria-pressed={subjectColor === color}
                  />
                ))}
              </div>

              {subjectState.error ? (
                <p className="text-[13.5px] font-medium text-danger">
                  {subjectState.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={subjectPending || !subjectName.trim()}
                className={cn(softPillClass, "w-fit bg-raised")}
              >
                <Plus className="size-4" aria-hidden />
                Add subject
              </button>
            </form>

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                className={cn(softPillClass, "gap-2 bg-transparent")}
                disabled={isPending}
                onClick={() => goToStep(1)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </button>
              <button
                type="button"
                className={cn(primaryPillClass, "gap-2")}
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await advanceOnboardingToPreferences();
                    if (result.error) toast.error(result.error);
                  });
                }}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <form action={finishAction} className="flex flex-col gap-6">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
                Study rhythm
              </h2>
              <p className="mt-1 text-[14px] text-ink-2">
                Tell Studi when you usually study. Everything is editable later in
                Settings.
              </p>
            </div>

            <div>
              <p className="mb-3 text-[14px] font-medium text-ink">
                Typical availability
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label
                    key={day}
                    className={cn(
                      "cursor-pointer rounded-full px-3.5 py-2 text-[13.5px] font-semibold",
                      availability[day]
                        ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                        : "bg-sunken text-ink-2",
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

            <div className="grid gap-4 min-[640px]:grid-cols-2">
              <Field label="Session duration" htmlFor="session_duration_minutes">
                <NativeSelect
                  id="session_duration_minutes"
                  name="session_duration_minutes"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(e.target.value)}
                >
                  {SESSION_DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins} minutes
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Break duration" htmlFor="break_duration_minutes">
                <NativeSelect
                  id="break_duration_minutes"
                  name="break_duration_minutes"
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(e.target.value)}
                >
                  {BREAK_DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {mins === 0 ? "No break" : `${mins} minutes`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <Field label="Weekly study goal (hours)" htmlFor="weekly_goal_hours" optional>
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
            </Field>

            {finishState.error ? (
              <p className="text-[13.5px] font-medium text-danger">
                {finishState.error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                className={cn(softPillClass, "gap-2 bg-transparent")}
                disabled={isPending || finishPending}
                onClick={() => goToStep(2)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back
              </button>
              <button type="submit" className={primaryPillClass} disabled={finishPending}>
                {finishPending ? "Saving…" : "Finish setup"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
