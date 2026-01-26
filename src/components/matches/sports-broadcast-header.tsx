'use client';

import { cn } from '@/lib/utils';
import { AddMatchDialog } from '@/components/add-match-dialog';
import type { Player } from '@/lib/types';

interface SportsBroadcastHeaderProps {
  allPlayers: Player[];
  disabled?: boolean;
  className?: string;
}

export function SportsBroadcastHeader({ allPlayers, disabled, className }: SportsBroadcastHeaderProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-card border border-border',
        'p-5 md:p-6',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Partidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Programa, visualiza y gestiona todos tus partidos
          </p>
        </div>

        <AddMatchDialog allPlayers={allPlayers} disabled={disabled} />
      </div>
    </div>
  );
}
