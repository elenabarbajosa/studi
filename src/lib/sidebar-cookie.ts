export const SIDEBAR_COOKIE = "studi-sidebar";

export function parseSidebarCollapsed(value: string | undefined | null) {
  return value === "collapsed";
}

export function writeSidebarCookie(collapsed: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=${maxAge}; samesite=lax`;
}
