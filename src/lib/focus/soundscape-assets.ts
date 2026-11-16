import type { SoundscapeId } from "@/lib/calendar";

export type SoundscapeKind = "silence" | "procedural" | "sample";

export type SoundscapeAsset = {
  kind: SoundscapeKind;
  /** Public URL for sample soundscapes (lazy-loaded). */
  url?: string;
  /** Runtime crossfade window near each loop boundary (ms). */
  crossfadeMs?: number;
  label: string;
  description: string;
};

/**
 * Soundscape registry. IDs stay stable so saved preferences keep working.
 * Sample files are pre-crossfaded seamless loops under public/audio/ambient/.
 */
export const SOUNDSCAPE_ASSETS: Record<SoundscapeId, SoundscapeAsset> = {
  silence: {
    kind: "silence",
    label: "Silence",
    description: "No ambient audio",
  },
  white_noise: {
    kind: "procedural",
    label: "White noise",
    description: "Continuous broadband noise",
  },
  rain: {
    kind: "sample",
    url: "/audio/ambient/rain.mp3",
    crossfadeMs: 3500,
    label: "Rain",
    description: "Gentle rain ambience",
  },
  cafe: {
    kind: "sample",
    url: "/audio/ambient/cafe.mp3",
    crossfadeMs: 2200,
    label: "Café",
    description: "Café chatter and machines",
  },
  forest: {
    kind: "sample",
    url: "/audio/ambient/forest.mp3",
    crossfadeMs: 2800,
    label: "Forest",
    description: "Forest ambience with birdsong",
  },
};

export function isSampleSoundscape(id: SoundscapeId): boolean {
  return SOUNDSCAPE_ASSETS[id].kind === "sample";
}

export function isProceduralSoundscape(id: SoundscapeId): boolean {
  return SOUNDSCAPE_ASSETS[id].kind === "procedural";
}

/** Secondary identical to primary would double loudness — treat as silence. */
export function resolveSecondarySoundscape(
  primary: SoundscapeId,
  secondary: SoundscapeId,
): SoundscapeId {
  if (secondary === "silence") return "silence";
  if (secondary === primary) return "silence";
  return secondary;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
