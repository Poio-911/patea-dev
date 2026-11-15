"use client";

import { SoccerPlayerIcon } from "@/components/icons/soccer-player-icon";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  onPhoto?: boolean;
};

export function Logo({ className, showWordmark = true, onPhoto = false }: LogoProps) {
  return (
    <div role="img" aria-label="Pateá" className={cn("flex items-center gap-2", className)}>
      <SoccerPlayerIcon className={cn('h-8 w-8 shrink-0', onPhoto ? 'text-[#CCFF33]' : 'text-primary')} />
      {showWordmark && (
        <span aria-hidden="true" className={cn('block text-xl font-bold font-headline tracking-tight truncate logo-text', onPhoto && 'text-white')}>Pateá</span>
      )}
    </div>
  );
}
