import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SocialProfileView } from "@/components/friends/social-profile-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireProfile } from "@/lib/auth";
import {
  getPendingRequestId,
  getSocialProfileByUsername,
} from "@/lib/data/friends";

type PageProps = {
  params: Promise<{ username: string }>;
};

async function ProfileContent({ params }: PageProps) {
  const { profile: me } = await requireProfile();
  const { username } = await params;
  const social = await getSocialProfileByUsername(username);

  if (!social) notFound();

  const requestId =
    social.friendship_status === "incoming" ||
    social.friendship_status === "outgoing"
      ? await getPendingRequestId(social.id)
      : null;

  return (
    <SocialProfileView
      profile={social}
      requestId={requestId}
      isOwner={social.id === me.id || social.friendship_status === "self"}
    />
  );
}

function ProfileFallback() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Skeleton className="mx-auto size-24 rounded-full" />
      <Skeleton className="mx-auto h-8 w-48" />
      <Skeleton className="mx-auto h-4 w-32" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default function SocialProfilePage(props: PageProps) {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent {...props} />
    </Suspense>
  );
}
