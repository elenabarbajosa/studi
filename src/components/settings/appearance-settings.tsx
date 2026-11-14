"use client";

import { useTransition } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { updateAccentColor, updateAppearance } from "@/actions/profile";
import { useSettingsSaveStatus } from "@/components/settings/settings-save-context";
import { useAccent } from "@/components/theme/theme-provider";
import {
  ACCENT_COLORS,
  ACCENT_META,
  APPEARANCE_MODES,
  type AccentColor,
  type AppearanceMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const MODE_META: Record<
  AppearanceMode,
  { label: string; icon: typeof Sun; preview: string; card: string; line: string; accent: string }
> = {
  light: {
    label: "Light",
    icon: Sun,
    preview: "#F4EFEB",
    card: "#FDFBFA",
    line: "#EDE6E1",
    accent: "var(--accent)",
  },
  dark: {
    label: "Dark",
    icon: Moon,
    preview: "#171315",
    card: "#262022",
    line: "#3A3034",
    accent: "var(--accent)",
  },
  system: {
    label: "System",
    icon: Monitor,
    preview: "linear-gradient(135deg, #F4EFEB 50%, #171315 50%)",
    card: "#FDFBFA",
    line: "#EDE6E1",
    accent: "var(--accent)",
  },
};

export function AppearanceSettings({
  appearance,
}: {
  appearance: AppearanceMode;
}) {
  const { setTheme, theme } = useTheme();
  const { accent, setAccent } = useAccent();
  const { setStatus } = useSettingsSaveStatus();
  const [isPending, startTransition] = useTransition();
  const selectedAppearance = (theme as AppearanceMode | undefined) ?? appearance;

  function handleAppearance(next: AppearanceMode) {
    setTheme(next);
    setStatus("saving");
    startTransition(async () => {
      const result = await updateAppearance(next);
      if (result.error) {
        toast.error(result.error);
        setTheme(appearance);
        setStatus("error");
        return;
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2200);
    });
  }

  function handleAccent(next: AccentColor) {
    const previous = accent;
    setAccent(next);
    setStatus("saving");
    startTransition(async () => {
      const result = await updateAccentColor(next);
      if (result.error) {
        toast.error(result.error);
        setAccent(previous);
        setStatus("error");
        return;
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2200);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 text-[14px] font-medium text-ink">Mode</p>
        <div className="grid grid-cols-3 gap-2.5">
          {APPEARANCE_MODES.map((mode) => {
            const meta = MODE_META[mode];
            const Icon = meta.icon;
            const selected = selectedAppearance === mode;
            return (
              <button
                key={mode}
                type="button"
                disabled={isPending}
                onClick={() => handleAppearance(mode)}
                className="flex flex-col gap-2 text-left outline-none focus-visible:rounded-[18px] focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
                aria-pressed={selected}
              >
                <div
                  className={cn(
                    "flex h-[96px] gap-2 overflow-hidden rounded-[18px] p-3 transition-shadow",
                    selected
                      ? "shadow-[0_0_0_2px_var(--accent-ink)]"
                      : "shadow-[0_0_0_1px_var(--hairline)]",
                  )}
                  style={{ background: meta.preview }}
                >
                  <div className="flex w-[30%] flex-col gap-1.5 pt-1">
                    <span className="h-1.5 w-4/5 rounded-full" style={{ background: meta.line }} />
                    <span className="h-1.5 rounded-full" style={{ background: meta.line }} />
                    <span className="h-1.5 w-[70%] rounded-full" style={{ background: meta.line }} />
                  </div>
                  <div
                    className="flex flex-1 flex-col gap-1.5 rounded-[10px] p-2"
                    style={{ background: meta.card }}
                  >
                    <span
                      className="h-5 rounded-md"
                      style={{ background: "var(--accent-soft)" }}
                    />
                    <span className="h-1.5 rounded-full" style={{ background: meta.line }} />
                    <span className="h-1.5 w-3/5 rounded-full" style={{ background: meta.line }} />
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-[13.5px]",
                    selected ? "font-semibold text-ink" : "font-medium text-ink-2",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-[14px] font-medium text-ink">Accent</p>
        <p className="mb-4 text-[13px] text-ink-3">
          Tints buttons, rings and highlights. Subject colors stay as they are.
        </p>
        <div className="flex flex-wrap gap-4">
          {ACCENT_COLORS.map((color) => {
            const meta = ACCENT_META[color];
            const selected = accent === color;
            return (
              <button
                key={color}
                type="button"
                disabled={isPending}
                onClick={() => handleAccent(color)}
                className="flex flex-col items-center gap-1.5 outline-none focus-visible:rounded-full focus-visible:shadow-[0_0_0_2px_var(--accent)]"
                aria-pressed={selected}
                aria-label={meta.label}
              >
                <span
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full transition-shadow",
                    selected
                      ? "shadow-[0_0_0_3px_var(--raised),0_0_0_5px_var(--accent-ink)]"
                      : "shadow-[0_0_0_1px_rgba(0,0,0,.08)]",
                  )}
                  style={{ background: meta.swatch }}
                >
                  {selected ? (
                    <Check className="size-4 text-white drop-shadow" aria-hidden />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-[12.5px]",
                    selected ? "font-semibold text-ink" : "font-medium text-ink-2",
                  )}
                >
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-[22px] bg-accent-soft px-5 py-4 md:rounded-[26px]">
        <div className="relative size-14 shrink-0">
          <svg width="56" height="56" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
            <circle
              cx="32"
              cy="32"
              r="27"
              fill="none"
              stroke="var(--raised)"
              strokeWidth="6"
            />
            <circle
              cx="32"
              cy="32"
              r="27"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="169.6"
              strokeDashoffset="70"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold tracking-[0.05em] text-accent-text uppercase">
            Preview
          </p>
          <p className="truncate text-[16px] font-semibold text-ink">
            {ACCENT_META[accent].label} · {MODE_META[selectedAppearance].label}
          </p>
        </div>
        <span className="hidden h-10 shrink-0 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground min-[640px]:inline-flex dark:bg-accent dark:text-ink-on-accent">
          Start
        </span>
      </div>

      <p className="text-[13px] text-ink-3">
        Reduce motion follows your system accessibility setting.
      </p>
    </div>
  );
}
