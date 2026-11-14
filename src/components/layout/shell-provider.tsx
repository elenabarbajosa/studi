"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { writeSidebarCookie } from "@/lib/sidebar-cookie";
import type { Profile } from "@/types/database";

/** Below this width the sidebar is a rail that expands as an overlay. */
export const WIDE_QUERY = "(min-width: 1100px)";
/** Below this width the sidebar is replaced by the mobile tab bar. */
export const TABLET_QUERY = "(min-width: 768px)";

type ShellContextValue = {
  profile: Profile;
  avatarSrc: string | null;
  collapsed: boolean;
  overlayOpen: boolean;
  isWide: boolean;
  toggleSidebar: () => void;
  closeOverlay: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

const ShellContext = React.createContext<ShellContextValue | null>(null);

function subscribeWide(callback: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function useIsWide() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

export function ShellProvider({
  profile,
  avatarSrc,
  defaultCollapsed,
  children,
}: {
  profile: Profile;
  avatarSrc: string | null;
  defaultCollapsed: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isWide = useIsWide();
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);

  const toggleSidebar = React.useCallback(() => {
    if (window.matchMedia(WIDE_QUERY).matches) {
      setCollapsed((prev) => {
        writeSidebarCookie(!prev);
        return !prev;
      });
    } else if (window.matchMedia(TABLET_QUERY).matches) {
      setOverlayOpen((prev) => !prev);
    }
  }, []);

  const closeOverlay = React.useCallback(() => setOverlayOpen(false), []);

  const [lastPathname, setLastPathname] = React.useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOverlayOpen(false);
  }

  const [lastWide, setLastWide] = React.useState(isWide);
  if (lastWide !== isWide) {
    setLastWide(isWide);
    setOverlayOpen(false);
  }

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();

      if (key === "k") {
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      } else if (key === "\\") {
        event.preventDefault();
        toggleSidebar();
      } else if (key === ",") {
        event.preventDefault();
        setCommandOpen(false);
        router.push("/settings");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleSidebar]);

  const value = React.useMemo(
    () => ({
      profile,
      avatarSrc,
      collapsed,
      overlayOpen,
      isWide,
      toggleSidebar,
      closeOverlay,
      commandOpen,
      setCommandOpen,
    }),
    [
      profile,
      avatarSrc,
      collapsed,
      overlayOpen,
      isWide,
      toggleSidebar,
      closeOverlay,
      commandOpen,
    ],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = React.useContext(ShellContext);
  if (!context) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return context;
}
