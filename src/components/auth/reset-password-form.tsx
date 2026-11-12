"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePassword, type AuthActionState } from "@/actions/auth";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 space-y-3 text-center sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This link is single-use. Pick a strong password you have not used
            here before.
          </p>
        </div>
      </div>

      <div className="studi-panel space-y-6 p-6 sm:p-8">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
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

          {state.error ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
