"use client";

import { createContext, useContext, useMemo, useState } from "react";

import type { SaveStatus } from "@/components/settings/use-autosave";

const SettingsSaveContext = createContext<{
  status: SaveStatus;
  setStatus: (status: SaveStatus) => void;
}>({
  status: "idle",
  setStatus: () => {},
});

export function SettingsSaveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const value = useMemo(() => ({ status, setStatus }), [status]);
  return (
    <SettingsSaveContext.Provider value={value}>
      {children}
    </SettingsSaveContext.Provider>
  );
}

export function useSettingsSaveStatus() {
  return useContext(SettingsSaveContext);
}
