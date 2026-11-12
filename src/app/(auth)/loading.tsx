import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-full" />
      <div className="studi-panel space-y-4 p-6 sm:p-8">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  );
}
