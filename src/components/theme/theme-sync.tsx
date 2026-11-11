"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

import type { AccentColor, AppearanceMode } from "@/lib/theme";
import { useAccent } from "@/components/theme/theme-provider";

type ThemeSyncProps = {
  appearance: AppearanceMode;
  accent: AccentColor;
};

export function ThemeSync({ appearance, accent }: ThemeSyncProps) {
  const { setTheme, theme } = useTheme();
  const { setAccent, accent: currentAccent } = useAccent();

  useEffect(() => {
    if (theme !== appearance) {
      setTheme(appearance);
    }
  }, [appearance, setTheme, theme]);

  useEffect(() => {
    if (currentAccent !== accent) {
      setAccent(accent);
    }
  }, [accent, currentAccent, setAccent]);

  return null;
}
