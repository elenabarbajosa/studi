"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Centred dialog from 768px, bottom sheet below it. Same children for both,
 * so creation and editing forms are written once.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideTitle = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hideTitle?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[rgba(36,28,31,0.32)] transition-opacity duration-200 ease-studi data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed z-50 flex flex-col bg-raised text-ink outline-none",
            "inset-x-0 bottom-0 max-h-[calc(100svh-24px)] rounded-t-[30px] pb-[max(20px,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(36,28,31,0.2)] transition-transform duration-300 ease-studi data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[min(88svh,820px)] md:w-[min(560px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px] md:pb-0 md:shadow-pop md:transition-[opacity,scale] md:duration-200 md:data-ending-style:translate-y-[-50%] md:data-ending-style:scale-95 md:data-ending-style:opacity-0 md:data-starting-style:translate-y-[-50%] md:data-starting-style:scale-95 md:data-starting-style:opacity-0",
            "motion-reduce:transition-opacity motion-reduce:data-ending-style:translate-y-0 motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0",
            className,
          )}
        >
          <span
            aria-hidden
            className="mx-auto mt-2.5 h-[5px] w-[38px] shrink-0 rounded-full bg-hairline md:hidden"
          />
          <div
            className={cn(
              "flex items-start gap-3 px-5 pt-3 pb-1 md:px-6 md:pt-5",
              hideTitle && "absolute top-4 right-0 z-10 p-0 pr-5 md:top-5 md:p-0 md:pr-6",
            )}
          >
            <div className={cn("min-w-0 flex-1", hideTitle && "sr-only")}>
              <DialogPrimitive.Title className="type-section text-ink">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[13.5px] text-ink-2">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close
              className={cn(
                "-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 outline-none transition-colors hover:bg-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--raised),0_0_0_4px_var(--accent)]",
                hideTitle && "ml-auto",
              )}
            >
              <XIcon className="size-4" aria-hidden />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-2 md:px-6 md:pb-6">
            {children}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
