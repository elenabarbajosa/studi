"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AudioWaveform,
  ChevronDown,
  CloudRain,
  Coffee,
  Pause,
  Play,
  Trees,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";

import { Tile, TileHeader } from "@/components/dashboard/tile";
import { SOUNDSCAPE_IDS, type SoundscapeId } from "@/lib/calendar";
import { SOUNDSCAPE_META, SoundscapeEngine } from "@/lib/focus/soundscapes";
import { cn } from "@/lib/utils";

const SOUND_ICON: Record<SoundscapeId, React.ComponentType<{ className?: string }>> = {
  silence: VolumeX,
  rain: CloudRain,
  cafe: Coffee,
  white_noise: AudioWaveform,
  forest: Trees,
};

const SHORT_LABEL: Record<SoundscapeId, string> = {
  silence: "Silence",
  rain: "Rain",
  cafe: "Café",
  white_noise: "Noise",
  forest: "Forest",
};

export type SoundscapePlayer = {
  playing: boolean;
  play: (primary: SoundscapeId, secondary: SoundscapeId) => Promise<void>;
  stop: () => void;
};

/**
 * One audio engine per provider mount (Focus session / Study Together runtime).
 * Survives Focus page remounts when owned by FocusSessionProvider.
 */
export function useSoundscapePlayer({
  enabled,
  volume,
  secondaryVolume,
}: {
  enabled: boolean;
  volume: number;
  secondaryVolume: number;
}): SoundscapePlayer {
  const engineRef = useRef<SoundscapeEngine | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const engine = new SoundscapeEngine();
    engine.setOnError((message) => {
      toast.error(message);
      setPlaying(false);
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setMasterVolume(volume);
    engineRef.current?.setVolumes(1, secondaryVolume);
  }, [volume, secondaryVolume]);

  async function play(nextPrimary: SoundscapeId, nextSecondary: SoundscapeId) {
    const engine = engineRef.current;
    if (!engine || !enabled) return;
    if (nextPrimary === "silence" && nextSecondary === "silence") {
      engine.pause();
      setPlaying(false);
      return;
    }
    await engine.play(nextPrimary, nextSecondary);
    setPlaying(engine.isPlaying());
  }

  function stop() {
    engineRef.current?.pause();
    setPlaying(false);
  }

  return { playing, play, stop };
}

type SoundscapeControlsProps = {
  player: SoundscapePlayer;
  primary: SoundscapeId;
  secondary: SoundscapeId;
  volume: number;
  secondaryVolume: number;
  enabled: boolean;
  onPrimaryChange: (id: SoundscapeId) => void;
  onSecondaryChange: (id: SoundscapeId) => void;
  onVolumeChange: (v: number) => void;
  onSecondaryVolumeChange: (v: number) => void;
  /** "immersive" is the single row of tiles used on the dark full-screen timer. */
  variant?: "panel" | "immersive" | "card";
  className?: string;
};

export function SoundscapeControls({
  player,
  primary,
  secondary,
  volume,
  secondaryVolume,
  enabled,
  onPrimaryChange,
  onSecondaryChange,
  onVolumeChange,
  onSecondaryVolumeChange,
  variant = "panel",
  className,
}: SoundscapeControlsProps) {
  const { playing, play, stop } = player;
  const [expanded, setExpanded] = useState(false);

  function pickPrimary(id: SoundscapeId) {
    if (id === primary && playing) {
      stop();
      return;
    }
    onPrimaryChange(id);
    const nextSecondary = secondary === id ? "silence" : secondary;
    if (nextSecondary !== secondary) onSecondaryChange(nextSecondary);
    void play(id, nextSecondary);
  }

  function pickMix(id: SoundscapeId) {
    const next = secondary === id ? "silence" : id;
    onSecondaryChange(next);
    if (next !== "silence" && secondaryVolume === 0) onSecondaryVolumeChange(0.35);
    if (playing || next !== "silence") void play(primary, next);
  }

  if (!enabled) {
    const message = (
      <p className={cn("text-[13px]", variant === "immersive" ? "text-white/60" : "text-ink-2")}>
        Focus sounds are off.{" "}
        <Link
          href="/settings/focus"
          className="font-semibold text-accent-text underline-offset-2 hover:underline"
        >
          Turn them on in Settings
        </Link>
      </p>
    );
    if (variant === "card") {
      return (
        <Tile className={cn("p-4 md:p-5", className)}>
          <TileHeader title="Ambience" />
          <div className="mt-3">{message}</div>
        </Tile>
      );
    }
    return message;
  }

  if (variant === "immersive") {
    return (
      <div className={cn("flex justify-center gap-2", className)} role="group" aria-label="Ambience">
        {SOUNDSCAPE_IDS.map((id) => {
          const Icon = SOUND_ICON[id];
          const active = playing && id === primary;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              aria-label={`${SOUNDSCAPE_META[id].label}${active ? ", playing" : ""}`}
              onClick={() => pickPrimary(id)}
              className={cn(
                "flex size-14 items-center justify-center rounded-[18px] outline-none transition-colors duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_#171315,0_0_0_4px_var(--accent)]",
                active ? "bg-accent text-[#241c1f]" : "bg-white/[0.08] text-white/80 hover:bg-white/[0.14]",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          );
        })}
      </div>
    );
  }

  const audible = SOUNDSCAPE_IDS.filter((id) => id !== "silence");
  const primaryLabel =
    primary === "silence" ? "Ambience" : SOUNDSCAPE_META[primary].label;
  const showMix = secondary !== "silence";

  const picker = (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]"
        role="group"
        aria-label="Ambience"
      >
        {SOUNDSCAPE_IDS.map((id) => {
          const Icon = SOUND_ICON[id];
          const isPrimary = playing && id === primary;
          const isMix = id !== "silence" && id === secondary && id !== primary;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isPrimary}
              aria-label={`${SOUNDSCAPE_META[id].label}${isPrimary ? ", playing" : ""}${isMix ? ", in mix" : ""}`}
              onClick={() => pickPrimary(id)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold outline-none transition-colors duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                isPrimary
                  ? "bg-ink text-canvas dark:bg-accent dark:text-ink-on-accent"
                  : isMix
                    ? "bg-accent-soft text-accent-text"
                    : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {SHORT_LABEL[id]}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            playing
              ? stop()
              : void play(primary === "silence" ? audible[0] : primary, secondary)
          }
          aria-label={playing ? "Pause ambience" : "Play ambience"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          {playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 fill-current" aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <VolumeSlider
            id="vol-primary"
            label={primaryLabel}
            value={volume}
            onChange={onVolumeChange}
          />
        </div>
      </div>

      {primary !== "silence" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-ink-3">Mix</span>
          {audible
            .filter((id) => id !== primary)
            .map((id) => {
              const active = secondary === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickMix(id)}
                  className={cn(
                    "h-7 rounded-full px-2.5 text-[11.5px] font-semibold outline-none transition-colors focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                    active
                      ? "bg-accent-soft text-accent-text"
                      : "bg-sunken text-ink-3 hover:text-ink",
                  )}
                >
                  {SHORT_LABEL[id]}
                </button>
              );
            })}
        </div>
      ) : null}

      {showMix ? (
        <VolumeSlider
          id="vol-secondary"
          label={`Mix · ${SOUNDSCAPE_META[secondary].label}`}
          value={secondaryVolume}
          onChange={onSecondaryVolumeChange}
        />
      ) : null}
    </div>
  );

  if (variant === "card") {
    return (
      <Tile className={cn("p-4 md:p-5", className)}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 text-left outline-none md:pointer-events-none"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <h2 className="type-tile text-ink">Ambience</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-3 md:hidden">
              {playing ? `Playing · ${primaryLabel}` : "Tap to choose a soundscape"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-ink-3 transition-transform duration-200 md:hidden",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <div className={cn("mt-3", expanded ? "block" : "hidden md:block")}>{picker}</div>
      </Tile>
    );
  }

  return <div className={cn("flex flex-col gap-3", className)}>{picker}</div>;
}

function VolumeSlider({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", disabled && "opacity-50")}>
      <div className="flex justify-between gap-2 text-[12.5px]">
        <label htmlFor={id} className="truncate text-ink-2">
          {label}
        </label>
        <span className="font-semibold tabular-nums text-ink">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
