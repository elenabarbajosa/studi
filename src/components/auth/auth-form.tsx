"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  type AuthActionState,
} from "@/actions/auth";
import { AuthMessage } from "@/components/auth/auth-message";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "login" | "signup";
  nextPath?: string;
  bannerError?: string;
  bannerNotice?: string;
};

const initialState: AuthActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Please wait…" : label}
    </Button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      disabled={pending}
    >
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}

export function AuthForm({
  mode,
  nextPath = "/dashboard",
  bannerError,
  bannerNotice,
}: AuthFormProps) {
  const action = mode === "login" ? signInWithPassword : signUpWithPassword;
  const [state, formAction] = useActionState(action, initialState);
  const [googleState, googleAction] = useActionState(
    async (): Promise<AuthActionState> => signInWithGoogle(nextPath),
    initialState,
  );

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 space-y-3 text-center sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            {mode === "login" ? "Welcome back" : "Create your space"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to continue studying with Studi."
              : "Set up a private academic workspace in a minute."}
          </p>
        </div>
      </div>

      <AuthMessage error={bannerError} notice={bannerNotice} />

      <div className="studi-panel space-y-6 p-6 sm:p-8">
        <form action={googleAction}>
          <GoogleButton />
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or email</span>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={nextPath} />

          {mode === "signup" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  placeholder="Elena"
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="elena_studies"
                  required
                  autoComplete="username"
                  pattern="[a-z0-9_]+"
                  title="Lowercase letters, numbers, and underscores only"
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@university.edu"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Password</Label>
              {mode === "login" ? (
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              ) : null}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {mode === "signup" ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          ) : null}

          {state.error || googleState.error ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error || googleState.error}
            </p>
          ) : null}

          {state.success ? (
            <p
              className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-foreground"
              role="status"
            >
              {state.success}
            </p>
          ) : null}

          <SubmitButton
            label={mode === "login" ? "Sign in" : "Create account"}
          />
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
