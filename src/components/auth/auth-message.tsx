const MESSAGES: Record<string, { tone: "error" | "success"; text: string }> = {
  not_configured: {
    tone: "error",
    text: "Supabase is not configured. Add your project URL and publishable key to .env.local.",
  },
  auth_callback: {
    tone: "error",
    text: "That confirmation or sign-in link is invalid or expired. Try again.",
  },
  recovery_required: {
    tone: "error",
    text: "Open the password reset link from your email to choose a new password.",
  },
  confirmed: {
    tone: "success",
    text: "Email confirmed. You are signed in.",
  },
  reset: {
    tone: "success",
    text: "Password updated. You are signed in.",
  },
};

type AuthMessageProps = {
  error?: string;
  notice?: string;
};

export function AuthMessage({ error, notice }: AuthMessageProps) {
  const mappedError = error ? MESSAGES[error] : undefined;
  const mappedNotice = notice ? MESSAGES[notice] : undefined;

  if (mappedError) {
    return (
      <p
        className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        role="alert"
      >
        {mappedError.text}
      </p>
    );
  }

  if (error) {
    return (
      <p
        className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        role="alert"
      >
        {decodeURIComponent(error)}
      </p>
    );
  }

  if (mappedNotice) {
    return (
      <p
        className="mb-4 rounded-lg bg-brand-soft px-3 py-2 text-sm text-foreground"
        role="status"
      >
        {mappedNotice.text}
      </p>
    );
  }

  return null;
}
