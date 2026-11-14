"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AudioWaveform, CloudRain, Coffee, Pause, Play, Trees, VolumeX } from "lucide-react";

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

/** One audio engine per page, shared by every ambience control that renders it. */
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
    engineRef.current = new SoundscapeEngine();
    return () => {
      engineRef.current?.dispose();
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
    setPlaying(true);
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
  variant?: "panel" | "immersive";
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
}: SoundscapeControlsProps) {
  const { playing, play, stop } = player;

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
    return (
      <p className={cn("text-[13px]", variant === "immersive" ? "text-white/60" : "text-ink-2")}>
        Focus sounds are off.{" "}
        <Link href="/settings" className="font-semibold text-accent-text underline-offset-2 hover:underline">
          Turn them on in Settings
        </Link>
      </p>
    );
  }

  if (variant === "immersive") {
    return (
      <div className="flex justify-center gap-2" role="group" aria-label="Ambience">
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

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Ambience">
        {SOUNDSCAPE_IDS.map((id) => {
          const Icon = SOUND_ICON[id];
          const isPrimary = playing && id === primary;
          const isMix = id !== "silence" && id === secondary && id !== primary;
          return (
            <div key={id} className="relative">
              <button
                type="button"
                aria-pressed={isPrimary}
                aria-label={`${SOUNDSCAPE_META[id].label}${isPrimary ? ", playing" : ""}`}
                onClick={() => pickPrimary(id)}
                className={cn(
                  "flex h-[76px] w-full flex-col items-center justify-center gap-1.5 rounded-[16px] pb-3 text-[12px] font-semibold outline-none transition-colors duration-200 ease-studi focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)] md:h-[84px]",
                  isPrimary
                    ? "bg-ink text-canvas dark:bg-accent dark:text-ink-on-accent"
                    : isMix
                      ? "bg-accent-soft text-accent-text"
                      : "bg-sunken text-ink-2 hover:bg-hover hover:text-ink",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {SHORT_LABEL[id]}
              </button>
              {id !== "silence" && id !== primary ? (
                <button
                  type="button"
                  aria-pressed={isMix}
                  aria-label={isMix ? `Remove ${SOUNDSCAPE_META[id].label} from the mix` : `Mix in ${SOUNDSCAPE_META[id].label}`}
                  onClick={() => pickMix(id)}
                  className={cn(
                    "absolute inset-x-1 bottom-1 h-5 rounded-full text-[10.5px] font-semibold outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]",
                    isMix ? "text-accent-text" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {isMix ? "Mixed" : "+ Mix"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? stop() : void play(primary === "silence" ? audible[0] : primary, secondary))}
          aria-label={playing ? "Pause ambience" : "Play ambience"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink outline-none transition-colors hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4 fill-current" aria-hidden />}
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-4">
          <VolumeSlider
            id="vol-primary"
            label={primary === "silence" ? "Volume" : SOUNDSCAPE_META[primary].label}
            value={volume}
            onChange={onVolumeChange}
          />
          <VolumeSlider
            id="vol-secondary"
            label={secondary === "silence" ? "Mix" : SOUNDSCAPE_META[secondary].label}
            value={secondaryVolume}
            onChange={onSecondaryVolumeChange}
            disabled={secondary === "silence"}
          />
        </div>
      </div>
    </div>
  );
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
