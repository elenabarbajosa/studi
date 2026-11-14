"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword, type AuthActionState } from "@/actions/auth";
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
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-8 flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="text-[30px] leading-[1.1] font-semibold tracking-[-0.035em] text-ink md:text-[32px]">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-2">
            This link is single-use. Pick a strong password you haven’t used here
            before.
          </p>
        </div>
      </div>

      <div className="rounded-[26px] bg-raised p-6 shadow-[0_0_0_1px_var(--hairline)] md:p-8">
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="New password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
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

          {state.error ? (
            <p
              className="rounded-[14px] bg-danger-soft px-3.5 py-2.5 text-[13.5px] font-medium text-danger"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
