export function siteUrlFromHeaders(headerList: Headers) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const origin = headerList.get("origin");
  if (origin) {
    return origin;
  }

  const host = headerList.get("host");
  const protocol = host?.includes("localhost") ? "http" : "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "Confirm your email before signing in. Check your inbox for the Studi confirmation link.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (lower.includes("user already registered")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 8 characters.";
  }

  return message;
}
