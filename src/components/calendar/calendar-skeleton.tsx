import { Skeleton } from "@/components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true" aria-label="Loading calendar">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-52 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="ml-auto hidden h-9 w-72 rounded-full md:block" />
      </div>
      <div className="flex gap-3.5">
        <Skeleton className="hidden h-[540px] w-[220px] rounded-[20px] min-[1280px]:block" />
        <Skeleton className="h-[540px] flex-1 rounded-[20px]" />
      </div>
    </div>
  );
}
