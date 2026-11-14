"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AudioWaveform,
  CloudRain,
  Coffee,
  Trees,
  VolumeX,
  Zap,
} from "lucide-react";

import { saveFocusPreferences } from "@/actions/focus";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAutosave } from "@/components/settings/use-autosave";
import { SwitchRow } from "@/components/studi/form-controls";
import { Slider } from "@/components/ui/slider";
import { SOUNDSCAPE_IDS, type SoundscapeId } from "@/lib/calendar";
import { SOUNDSCAPE_META } from "@/lib/focus/soundscapes";
import type { FocusPreferences } from "@/lib/focus/types";
import { cn } from "@/lib/utils";

type FocusPreferencesFormProps = {
  preferences: FocusPreferences;
};

const FOCUS_PRESETS = [
  { minutes: 25, label: "Classic", icon: Zap },
  { minutes: 45, label: "Deep", icon: Coffee },
  { minutes: 50, label: "Block", icon: Trees },
  { minutes: 60, label: "Long", icon: AudioWaveform },
] as const;

const SOUND_ICONS: Record<SoundscapeId, typeof VolumeX> = {
  silence: VolumeX,
  rain: CloudRain,
  cafe: Coffee,
  white_noise: AudioWaveform,
  forest: Trees,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number, step: number) {
  return Math.round(n / step) * step;
}

export function FocusPreferencesForm({ preferences }: FocusPreferencesFormProps) {
  const [prefs, setPrefs] = useState(preferences);
  const { setStatus } = useSettingsSaveStatus();

  const save = useCallback(async (next: FocusPreferences) => {
    return saveFocusPreferences(next);
  }, []);

  const { status, error } = useAutosave(prefs, save);
  useEffect(() => {
    setStatus(status);
  }, [status, setStatus]);

  function setFocusMinutes(raw: number) {
    const minutes = clamp(snap(raw, 5), 5, 120);
    setPrefs((p) => ({ ...p, pomodoro_focus_minutes: minutes }));
  }

  const isCustomFocus = !FOCUS_PRESETS.some(
    (p) => p.minutes === prefs.pomodoro_focus_minutes,
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[14px] text-ink-2">
        Changing these values does not alter a timer that is already running in Focus
        or a Study Together room.
      </p>

      <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
        {FOCUS_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const selected = prefs.pomodoro_focus_minutes === preset.minutes;
          return (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => setFocusMinutes(preset.minutes)}
              className={cn(
                "flex flex-col gap-2 rounded-[18px] p-3.5 text-left outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                selected
                  ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                  : "bg-sunken text-ink hover:bg-hover",
              )}
              aria-pressed={selected}
            >
              <Icon className="size-[18px] opacity-90" aria-hidden />
              <span className="flex flex-col">
                <span className="text-[14px] font-semibold">{preset.label}</span>
                <span
                  className={cn(
                    "text-[12px]",
                    selected ? "opacity-85" : "text-ink-3",
                  )}
                >
                  {preset.minutes} min focus
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-5 rounded-[22px] bg-sunken p-5 md:rounded-[26px] md:p-6">
        <DurationSlider
          label="Focus"
          value={prefs.pomodoro_focus_minutes}
          min={5}
          max={120}
          step={5}
          onChange={setFocusMinutes}
          hint={isCustomFocus ? "Custom" : undefined}
        />
        <DurationSlider
          label="Short break"
          value={prefs.pomodoro_short_break_minutes}
          min={1}
          max={30}
          step={1}
          onChange={(v) =>
            setPrefs((p) => ({
              ...p,
              pomodoro_short_break_minutes: clamp(v, 1, 30),
            }))
          }
        />
        <DurationSlider
          label="Long break"
          value={prefs.pomodoro_long_break_minutes}
          min={5}
          max={60}
          step={5}
          onChange={(v) =>
            setPrefs((p) => ({
              ...p,
              pomodoro_long_break_minutes: clamp(snap(v, 5), 5, 60),
            }))
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[14px] font-medium text-ink">Long break after</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Intervals before long break">
            {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => {
              const selected = prefs.pomodoro_intervals_before_long === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setPrefs((p) => ({ ...p, pomodoro_intervals_before_long: n }))
                  }
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-[13.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                    selected
                      ? "bg-primary text-primary-foreground dark:bg-accent dark:text-ink-on-accent"
                      : "bg-raised text-ink hover:bg-hover",
                  )}
                  aria-pressed={selected}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-[color:var(--hairline)]">
        <div className="py-1">
          <SwitchRow
            label="Auto-start breaks and next focus"
            checked={prefs.auto_start_breaks}
            onChange={(checked) =>
              setPrefs((p) => ({ ...p, auto_start_breaks: checked }))
            }
          />
        </div>
        <div className="py-1">
          <SwitchRow
            label="Ambient sounds and phase chimes"
            checked={prefs.focus_sound_enabled}
            onChange={(checked) =>
              setPrefs((p) => ({ ...p, focus_sound_enabled: checked }))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-medium text-ink">Default soundscape</p>
        <div className="grid grid-cols-5 gap-2">
          {SOUNDSCAPE_IDS.map((id) => {
            const Icon = SOUND_ICONS[id];
            const selected = prefs.soundscape_primary === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!prefs.focus_sound_enabled}
                onClick={() =>
                  setPrefs((p) => ({ ...p, soundscape_primary: id }))
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-[16px] px-2 py-3 text-center outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-40",
                  selected
                    ? "bg-accent-soft text-accent-text"
                    : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
                )}
                aria-pressed={selected}
                aria-label={SOUNDSCAPE_META[id].label}
              >
                <Icon className="size-5" aria-hidden />
                <span className="text-[11.5px] font-semibold">
                  {SOUNDSCAPE_META[id].label}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 min-[640px]:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Mix with
            <select
              value={prefs.soundscape_secondary}
              disabled={!prefs.focus_sound_enabled}
              onChange={(e) =>
                setPrefs((p) => ({
                  ...p,
                  soundscape_secondary: e.target.value as SoundscapeId,
                }))
              }
              className="h-10 rounded-[14px] border-transparent bg-sunken px-3.5 text-sm text-ink outline-none focus-visible:bg-raised focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] disabled:opacity-40"
            >
              {SOUNDSCAPE_IDS.map((id) => (
                <option key={id} value={id}>
                  {SOUNDSCAPE_META[id].label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px] font-medium text-ink-2">
              <span>Volume</span>
              <span className="tabular-nums text-ink">
                {Math.round(prefs.soundscape_volume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[prefs.soundscape_volume]}
              disabled={!prefs.focus_sound_enabled}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? Number(v[0]) : Number(v);
                setPrefs((p) => ({
                  ...p,
                  soundscape_volume: clamp(next, 0, 1),
                }));
              }}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DurationSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-ink">
          {label}
          {hint ? (
            <span className="ml-2 text-[12px] font-medium text-accent-text">
              {hint}
            </span>
          ) : null}
        </span>
        <span className="text-[22px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
          {value}
          <span className="ml-1 text-[13px] font-medium text-ink-2">min</span>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => {
          onChange(Array.isArray(v) ? Number(v[0]) : Number(v));
        }}
        getAriaValueText={(formatted) => `${formatted} minutes`}
      />
      <div className="flex justify-between text-[11.5px] text-ink-3">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
