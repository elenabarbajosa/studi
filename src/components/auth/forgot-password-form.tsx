"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  requestPasswordReset,
  type AuthActionState,
} from "@/actions/auth";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 space-y-3 text-center sm:text-left">
        <Brand href="/" size="md" />
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            Reset your password
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email and we will send a secure reset link.
          </p>
        </div>
      </div>

      <div className="studi-panel space-y-6 p-6 sm:p-8">
        <form action={formAction} className="space-y-4">
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

          {state.error ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {state.error}
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

          <SubmitButton />
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
