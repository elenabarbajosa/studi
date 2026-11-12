import {
  DEFAULT_ACCENT,
  isAccentColor,
  type AccentColor,
} from "@/lib/theme";

export const ACCENT_COOKIE = "studi-accent";

export function parseAccentCookie(value: string | undefined | null): AccentColor {
  if (value && isAccentColor(value)) {
    return value;
  }
  return DEFAULT_ACCENT;
}

/** Client-side cookie write so the next document request SSR-matches. */
export function writeAccentCookie(accent: AccentColor) {
  if (typeof document === "undefined") {
    return;
  }

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${ACCENT_COOKIE}=${encodeURIComponent(accent)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Inline script: apply accent cookie before hydration to avoid mismatches. */
export const accentBootstrapScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${ACCENT_COOKIE}=([^;]*)/);if(m){var v=decodeURIComponent(m[1]);if(/^(pink|blue|green|purple|peach|neutral)$/.test(v)){document.documentElement.setAttribute('data-accent',v);}}}catch(e){}})();`;
