"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { friendlyAuthError, siteUrlFromHeaders } from "@/lib/site-url";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  success?: string;
};

const notConfigured: AuthActionState = {
  error:
    "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
};

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return notConfigured;
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  const next = String(formData.get("next") || "/dashboard");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signUpWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return notConfigured;
  }

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    username: formData.get("username"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sign-up data" };
  }

  const username = parsed.data.username.toLowerCase();
  const displayName = parsed.data.displayName.trim();
  const supabase = await createClient();

  const { data: available, error: availabilityError } = await supabase.rpc(
    "username_is_available",
    { desired: username },
  );

  if (availabilityError) {
    return {
      error:
        "Could not verify username availability. Apply the profiles SQL migration in Supabase, then try again.",
    };
  }

  if (!available) {
    return { error: "That username is already taken. Choose another." };
  }

  const headerList = await headers();
  const siteUrl = siteUrlFromHeaders(headerList);

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      data: {
        username,
        display_name: displayName,
      },
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // If email confirmation is disabled, a session is returned immediately.
  if (data.session && data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        username,
        display_name: displayName,
      })
      .eq("id", data.user.id);

    if (profileError?.code === "23505") {
      return {
        error:
          "Account created, but that username was taken at the last moment. Sign in and pick another in Settings.",
      };
    }

    redirect("/dashboard");
  }

  return {
    success:
      "Account created. Check your email and open the confirmation link to finish signing up, then sign in.",
  };
}

export async function signInWithGoogle(
  nextPath = "/dashboard",
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return notConfigured;
  }

  const headerList = await headers();
  const siteUrl = siteUrlFromHeaders(headerList);
  const supabase = await createClient();
  const safeNext = nextPath.startsWith("/") ? nextPath : "/dashboard";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Unable to start Google sign-in." };
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return notConfigured;
  }

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const headerList = await headers();
  const siteUrl = siteUrlFromHeaders(headerList);
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return {
    success:
      "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.",
  };
}

export async function updatePassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return notConfigured;
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your reset link is missing or expired. Request a new password reset email.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/dashboard?reset=success");
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
