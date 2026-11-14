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
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 md:gap-5">
      <Skeleton className="h-5 w-20 rounded-lg" />
      <Skeleton className="h-80 w-full rounded-[22px] md:rounded-[26px]" />
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
