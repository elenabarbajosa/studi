"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SOUNDSCAPE_IDS, type SoundscapeId } from "@/lib/calendar";
import {
  SOUNDSCAPE_META,
  SoundscapeEngine,
} from "@/lib/focus/soundscapes";

type SoundscapeControlsProps = {
  primary: SoundscapeId;
  secondary: SoundscapeId;
  volume: number;
  secondaryVolume: number;
  enabled: boolean;
  onPrimaryChange: (id: SoundscapeId) => void;
  onSecondaryChange: (id: SoundscapeId) => void;
  onVolumeChange: (v: number) => void;
  onSecondaryVolumeChange: (v: number) => void;
  compact?: boolean;
};

export function SoundscapeControls({
  primary,
  secondary,
  volume,
  secondaryVolume,
  enabled,
  onPrimaryChange,
  onSecondaryChange,
  onVolumeChange,
  onSecondaryVolumeChange,
  compact = false,
}: SoundscapeControlsProps) {
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

  useEffect(() => {
    if (!playing || !enabled) return;
    void engineRef.current?.play(primary, secondary);
  }, [primary, secondary, playing, enabled]);

  async function toggle() {
    if (!enabled) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      engine.pause();
      setPlaying(false);
      return;
    }
    await engine.play(primary, secondary);
    setPlaying(true);
  }

  if (!enabled) {
    return (
      <p className="text-xs text-muted-foreground">
        Focus sounds are disabled in Settings.
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={playing ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => void toggle()}
        >
          {playing ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {playing ? "Pause sounds" : "Play sounds"}
        </Button>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Volume2 className="size-3.5" />
          Procedural ambience
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sound-primary">Primary</Label>
          <select
            id="sound-primary"
            value={primary}
            onChange={(e) => onPrimaryChange(e.target.value as SoundscapeId)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {SOUNDSCAPE_IDS.map((id) => (
              <option key={id} value={id}>
                {SOUNDSCAPE_META[id].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sound-secondary">Mix (optional)</Label>
          <select
            id="sound-secondary"
            value={secondary}
            onChange={(e) => onSecondaryChange(e.target.value as SoundscapeId)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {SOUNDSCAPE_IDS.map((id) => (
              <option key={id} value={id}>
                {SOUNDSCAPE_META[id].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vol-primary">Volume</Label>
          <input
            id="vol-primary"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vol-secondary">Mix volume</Label>
          <input
            id="vol-secondary"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={secondaryVolume}
            onChange={(e) => onSecondaryVolumeChange(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
      </div>
    </div>
  );
}
