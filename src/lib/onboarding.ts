import type { OnboardingStatus } from "@/lib/subjects";
import type { Profile } from "@/types/database";

export function needsOnboarding(profile: Profile) {
  return (
    profile.onboarding_status === "pending" ||
    profile.onboarding_status === "in_progress"
  );
}

export function canResumeOnboarding(profile: Profile) {
  return (
    profile.onboarding_status === "pending" ||
    profile.onboarding_status === "in_progress" ||
    profile.onboarding_status === "skipped"
  );
}

export function onboardingLabel(status: OnboardingStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "skipped":
      return "Skipped";
    case "in_progress":
      return "In progress";
    default:
      return "Not started";
  }
}
