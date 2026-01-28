"use client";

import Link from "next/link";
import Image from "next/image";
import { NikeSwoosh } from "@/components/icons/nike-swoosh";
import { useTheme } from "next-themes";
import { SoccerPlayerIcon } from "@/components/icons/soccer-player-icon";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function Logo({ className, showWordmark = true }: LogoProps) {
  const { theme } = useTheme();

  if (theme === "nike") {
    // Nike swoosh logo rendered via React component (currentColor-driven)
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <NikeSwoosh className="h-8 w-auto text-foreground" />
        {showWordmark && (
          <span className="hidden sm:block text-2xl font-bold tracking-wide text-foreground/90">
            NIKE FOOTBALL
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <SoccerPlayerIcon className="h-8 w-8 text-primary" />
      {showWordmark && (
        <span className="hidden sm:block text-xl font-bold font-headline">Pateá</span>
      )}
    </div>
  );
}
