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
import { Field } from "@/components/studi/form-controls";
import { primaryPillClass, softPillClass } from "@/components/studi/page-title";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <button type="submit" className={cn(primaryPillClass, "h-11 w-full justify-center md:h-11")} disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn(softPillClass, "h-11 w-full justify-center gap-2 md:h-11")}
      disabled={pending}
    >
      <GoogleMark />
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
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
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[32px]">
            {mode === "login" ? "Welcome back" : "Create your space"}
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">
            {mode === "login"
              ? "Sign in to continue studying with Studi."
              : "A private academic workspace in a minute."}
          </p>
        </div>
      </div>

      <AuthMessage error={bannerError} notice={bannerNotice} />

      <div className="flex flex-col gap-5 rounded-[26px] bg-raised p-6 shadow-[0_0_0_1px_var(--hairline)] md:p-8">
        <form action={googleAction}>
          <GoogleButton />
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[color:var(--hairline)]" />
          </div>
          <div className="relative flex justify-center text-[12px] font-medium tracking-[0.04em] text-ink-3 uppercase">
            <span className="bg-raised px-3">or email</span>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={nextPath} />

          {mode === "signup" ? (
            <>
              <Field label="Display name" htmlFor="displayName">
                <Input
                  id="displayName"
                  name="displayName"
                  placeholder="Elena"
                  required
                  autoComplete="name"
                />
              </Field>
              <Field label="Username" htmlFor="username">
                <Input
                  id="username"
                  name="username"
                  placeholder="elena_studies"
                  required
                  autoComplete="username"
                  pattern="[a-z0-9_]+"
                  title="Lowercase letters, numbers, and underscores only"
                />
              </Field>
            </>
          ) : null}

          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@university.edu"
              required
              autoComplete="email"
            />
          </Field>

          <div className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="password" className="text-[13px] font-medium text-ink-2">
                Password
              </label>
              {mode === "login" ? (
                <Link
                  href="/forgot-password"
                  className="text-[12.5px] font-medium text-ink-3 underline-offset-4 hover:text-ink hover:underline"
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
            <Field label="Confirm password" htmlFor="confirmPassword">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
          ) : null}

          {state.error || googleState.error ? (
            <p
              className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] font-medium text-danger"
              role="alert"
            >
              {state.error || googleState.error}
            </p>
          ) : null}

          {state.success ? (
            <p
              className="rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-[13.5px] font-medium text-ink"
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

      <p className="mt-6 text-center text-[14px] text-ink-2">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-accent-text underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
