"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { Loader2, MailX, Users } from "lucide-react";
import { toast } from "sonner";

import { acceptInviteByToken } from "@/actions/study-together";
import { EmptyPanel } from "@/components/studi/progress-bits";
import { softPillClass } from "@/components/studi/page-title";
import { Skeleton } from "@/components/ui/skeleton";

function JoinContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || done) return;
    startTransition(async () => {
      const result = await acceptInviteByToken(token);
      setDone(true);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Joined room");
      if (result.roomId) router.replace(`/study-together/${result.roomId}`);
      else router.replace("/study-together");
    });
  }, [token, done, router]);

  const failed = !token || Boolean(error);

  return (
    <div className="mx-auto max-w-md py-16">
      <EmptyPanel
        icon={failed ? MailX : isPending || !done ? Loader2 : Users}
        title={!token ? "This invite link is incomplete" : error ? "Couldn’t join this room" : "Joining the room…"}
        body={
          !token
            ? "The link is missing its invite code. Ask your friend to send it again."
            : error
              ? error
              : "Checking your invitation. Private rooms stay private."
        }
        action={
          <button type="button" className={softPillClass} onClick={() => router.push("/study-together")}>
            Back to Study Together
          </button>
        }
      />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-20 h-40 w-full max-w-md rounded-[26px]" />}>
      <JoinContent />
    </Suspense>
  );
}
