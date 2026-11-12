"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

import { writeAccentCookie } from "@/lib/accent-cookie";
import {
  DEFAULT_ACCENT,
  type AccentColor,
  type AppearanceMode,
} from "@/lib/theme";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultAppearance?: AppearanceMode;
  defaultAccent?: AccentColor;
};

type AccentContextValue = {
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
};

const AccentContext = React.createContext<AccentContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultAppearance = "system",
  defaultAccent = DEFAULT_ACCENT,
}: ThemeProviderProps) {
  const [accent, setAccentState] = React.useState<AccentColor>(defaultAccent);

  const setAccent = React.useCallback((next: AccentColor) => {
    setAccentState(next);
    document.documentElement.setAttribute("data-accent", next);
    writeAccentCookie(next);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultAppearance}
      enableSystem
      disableTransitionOnChange
      storageKey="studi-appearance"
    >
      <AccentContext.Provider value={{ accent, setAccent }}>
        {children}
      </AccentContext.Provider>
    </NextThemesProvider>
  );
}

export function useAccent() {
  const context = React.useContext(AccentContext);
  if (!context) {
    throw new Error("useAccent must be used within ThemeProvider");
  }
  return context;
}
