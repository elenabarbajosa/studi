"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { acceptInviteByToken } from "@/actions/study-together";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function JoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token || done) return;
    startTransition(async () => {
      const result = await acceptInviteByToken(token);
      setDone(true);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Joined room");
      if (result.roomId) router.replace(`/study-together/${result.roomId}`);
      else router.replace("/study-together");
    });
  }, [token, done, router]);

  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="font-display text-3xl tracking-tight">Joining room…</h1>
      <p className="text-sm text-muted-foreground">
        Validating your invitation. Private room privacy rules still apply.
      </p>
      {!token ? (
        <p className="text-sm text-destructive" role="alert">
          Missing invite token.
        </p>
      ) : null}
      {isPending ? <p className="text-sm text-muted-foreground">Please wait…</p> : null}
      <Button type="button" variant="outline" onClick={() => router.push("/study-together")}>
        Back to Study Together
      </Button>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-20 h-40 w-full max-w-md" />}>
      <JoinContent />
    </Suspense>
  );
}
