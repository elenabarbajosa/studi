"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loginSchema, signupSchema } from "@/lib/validations/auth";

export type AuthActionState = {
  error?: string;
  success?: string;
};

function siteUrlFromHeaders(headerList: Headers) {
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

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured yet. Copy .env.example to .env.local and add your project keys.",
    };
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
    return { error: error.message };
  }

  const next = String(formData.get("next") || "/dashboard");
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signUpWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured yet. Copy .env.example to .env.local and add your project keys.",
    };
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

  const headerList = await headers();
  const siteUrl = siteUrlFromHeaders(headerList);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        username: parsed.data.username,
        display_name: parsed.data.displayName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    success:
      "Check your email to confirm your account before signing in. If email confirmation is disabled in Supabase, you can sign in immediately.",
  };
}

export async function signInWithGoogle(
  nextPath = "/dashboard",
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured yet. Copy .env.example to .env.local and add your project keys.",
    };
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
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { error: "Unable to start Google sign-in." };
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
