export const APPEARANCE_MODES = ["light", "dark", "system"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const ACCENT_COLORS = [
  "pink",
  "blue",
  "green",
  "purple",
  "peach",
  "neutral",
] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_APPEARANCE: AppearanceMode = "system";
export const DEFAULT_ACCENT: AccentColor = "pink";

export const ACCENT_META: Record<
  AccentColor,
  { label: string; swatch: string; description: string }
> = {
  pink: {
    label: "Soft Pink",
    swatch: "oklch(0.82 0.08 10)",
    description: "Warm pastel rose — the default Studi look",
  },
  blue: {
    label: "Sky Blue",
    swatch: "oklch(0.78 0.08 240)",
    description: "Calm study blue",
  },
  green: {
    label: "Mint",
    swatch: "oklch(0.82 0.08 160)",
    description: "Fresh focus green",
  },
  purple: {
    label: "Lavender",
    swatch: "oklch(0.78 0.08 300)",
    description: "Soft lilac accent",
  },
  peach: {
    label: "Peach",
    swatch: "oklch(0.84 0.08 50)",
    description: "Gentle warm peach",
  },
  neutral: {
    label: "Neutral",
    swatch: "oklch(0.55 0.01 260)",
    description: "Quiet graphite",
  },
};

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return (
    typeof value === "string" &&
    (APPEARANCE_MODES as readonly string[]).includes(value)
  );
}

export function isAccentColor(value: unknown): value is AccentColor {
  return (
    typeof value === "string" &&
    (ACCENT_COLORS as readonly string[]).includes(value)
  );
}
