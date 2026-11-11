"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { bottomNav, mainNav } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type MobileNavProps = {
  profile: Profile;
};

export function MobileNav({ profile }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:hidden">
      <Brand href="/dashboard" size="sm" />
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[18rem] p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle>
              <Brand href="/dashboard" size="sm" />
            </SheetTitle>
          </SheetHeader>
          <nav className="space-y-1 p-3" aria-label="Mobile">
            {[...mainNav, ...bottomNav].map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1">{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-border px-4 py-4 text-sm">
            <p className="font-medium">
              {profile.display_name || profile.username}
            </p>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
