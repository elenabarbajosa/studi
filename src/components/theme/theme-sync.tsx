"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import { writeAccentCookie } from "@/lib/accent-cookie";
import type { AccentColor, AppearanceMode } from "@/lib/theme";
import { useAccent } from "@/components/theme/theme-provider";

type ThemeSyncProps = {
  appearance: AppearanceMode;
  accent: AccentColor;
};

/**
 * Applies saved profile preferences when the authenticated shell mounts or
 * when server-provided values change (e.g. after login as a different user).
 */
export function ThemeSync({ appearance, accent }: ThemeSyncProps) {
  const { setTheme } = useTheme();
  const { setAccent } = useAccent();
  const appliedAppearance = useRef<AppearanceMode | null>(null);
  const appliedAccent = useRef<AccentColor | null>(null);

  useEffect(() => {
    if (appliedAppearance.current === appearance) {
      return;
    }
    appliedAppearance.current = appearance;
    setTheme(appearance);
  }, [appearance, setTheme]);

  useEffect(() => {
    if (appliedAccent.current === accent) {
      return;
    }
    appliedAccent.current = accent;
    setAccent(accent);
    writeAccentCookie(accent);
  }, [accent, setAccent]);

  return null;
}
