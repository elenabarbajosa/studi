"use client";

import { ExternalLink } from "lucide-react";

import { ResponsiveDialog } from "@/components/studi/responsive-dialog";
import { softPillClass } from "@/components/studi/page-title";
import type { CalItem } from "@/lib/calendar-items";

export function ExternalEventDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CalItem | null;
}) {
  if (!item?.external) return null;
  const event = item.external;
  const link = item.externalHtmlLink;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={event.title || "External event"}
      description="Read-only from your connected calendar. Studi does not write changes back."
      className="md:w-[min(480px,calc(100vw-48px))]"
      contentClassName="px-5 pb-5 md:px-6"
      footer={
        link ? (
          <div className="flex justify-end gap-2 border-t border-hairline px-5 py-3 md:px-6">
            <a
              className={softPillClass}
              href={link}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Open in source calendar
            </a>
          </div>
        ) : undefined
      }
    >
      <dl className="space-y-3 text-[14px]">
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            When
          </dt>
          <dd className="text-ink">
            {event.all_day
              ? `${event.starts_at.slice(0, 10)}${
                  event.ends_at ? ` → ${event.ends_at.slice(0, 10)}` : ""
                }`
              : `${new Date(event.starts_at).toLocaleString()}${
                  event.ends_at
                    ? ` – ${new Date(event.ends_at).toLocaleString()}`
                    : ""
                }`}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            Source
          </dt>
          <dd className="text-ink">{item.meta}</dd>
        </div>
        {event.location ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
              Location
            </dt>
            <dd className="text-ink">{event.location}</dd>
          </div>
        ) : null}
        {event.description ? (
          <div>
            <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
              Notes
            </dt>
            <dd className="whitespace-pre-wrap break-words text-ink-2">
              {event.description.slice(0, 2000)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-3">
            Availability
          </dt>
          <dd className="text-ink capitalize">{event.show_as}</dd>
        </div>
      </dl>
    </ResponsiveDialog>
  );
}
