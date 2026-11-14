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

/**
 * Swatches are the approved accent base colors.
 * `green` and `purple` stay as stored profile values and render Sage and Lavender.
 */
export const ACCENT_META: Record<
  AccentColor,
  { label: string; swatch: string; description: string }
> = {
  pink: {
    label: "Pink",
    swatch: "#D98A9B",
    description: "Warm rose — the default Studi accent",
  },
  blue: {
    label: "Blue",
    swatch: "#7FA8D9",
    description: "Calm study blue",
  },
  green: {
    label: "Sage",
    swatch: "#86B79B",
    description: "Quiet sage",
  },
  purple: {
    label: "Lavender",
    swatch: "#A99BDB",
    description: "Soft lilac",
  },
  peach: {
    label: "Peach",
    swatch: "#E7A57F",
    description: "Warm peach",
  },
  neutral: {
    label: "Neutral",
    swatch: "#9C9094",
    description: "Quiet stone",
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
