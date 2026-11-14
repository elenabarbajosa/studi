"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordReset, type AuthActionState } from "@/actions/auth";
import { Brand } from "@/components/shared/brand";
import { Field } from "@/components/studi/form-controls";
import { primaryPillClass } from "@/components/studi/page-title";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn(primaryPillClass, "h-11 w-full justify-center md:h-11")}
      disabled={pending}
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[32px]">
            Reset your password
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">
            Enter your account email and we’ll send a secure reset link.
          </p>
        </div>
      </div>

      <div className="rounded-[26px] bg-raised p-6 shadow-[0_0_0_1px_var(--hairline)] md:p-8">
        <form action={formAction} className="flex flex-col gap-4">
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

          {state.error ? (
            <p
              className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] font-medium text-danger"
              role="alert"
            >
              {state.error}
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

          <SubmitButton />
        </form>
      </div>

      <p className="mt-6 text-center text-[14px] text-ink-2">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-accent-text underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
