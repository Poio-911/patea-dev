
"use client";
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Player, AttributeKey, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DelIcon, MedIcon, DefIcon, PorIcon } from './icons/positions';

export const positionConfig: Record<PlayerPosition, { name: string; Icon: React.ElementType, badgeClasses: string, textColor: string }> = {
  POR: { name: 'Portero', Icon: PorIcon, badgeClasses: 'bg-orange-100 text-orange-800 game:bg-transparent game:text-orange-400 dark:bg-orange-900/40 dark:text-orange-300', textColor: 'text-orange-600 game:text-orange-400' },
  DEF: { name: 'Defensa', Icon: DefIcon, badgeClasses: 'bg-green-100 text-green-800 game:bg-transparent game:text-green-400 dark:bg-green-900/40 dark:text-green-300', textColor: 'text-green-600 game:text-green-400' },
  MED: { name: 'Medio', Icon: MedIcon, badgeClasses: 'bg-blue-100 text-blue-800 game:bg-transparent game:text-blue-400 dark:bg-blue-900/40 dark:text-blue-300', textColor: 'text-blue-600 game:text-blue-400' },
  DEL: { name: 'Delantero', Icon: DelIcon, badgeClasses: 'bg-red-100 text-red-800 game:bg-transparent game:text-red-400 dark:bg-red-900/40 dark:text-red-300', textColor: 'text-red-600 game:text-red-400' },
};

export const getPositionBadgeClasses = (position: PlayerPosition) => positionConfig[position].badgeClasses;

export type PlayerOvrProps = { value: number; size?: 'compact' | 'standard'; highlight?: boolean };
export function PlayerOvr({ value, size = 'standard', highlight }: PlayerOvrProps) {
  const base = 'font-headline font-bold tabular-nums';
  if (size === 'compact') {
    return (
      <Badge variant="secondary" className={cn('text-xs px-2 py-0.5 font-bold', highlight && 'ring-2 ring-primary/40')}>{value}</Badge>
    );
  }
  return (
    <span className={cn(base, 'text-4xl leading-none', highlight && 'text-primary')}>{value}</span>
  );
}

const attributeLabels: Record<AttributeKey, string> = { PAC: 'RIT', SHO: 'TIR', PAS: 'PAS', DRI: 'REG', DEF: 'DEF', PHY: 'FIS' };

export type AttributesGridProps = { player: Player; className?: string };
export function AttributesGrid({ player, className }: AttributesGridProps) {
  const stats: { key: AttributeKey; value: number }[] = [
    { key: 'PAC', value: player.pac },
    { key: 'SHO', value: player.sho },
    { key: 'PAS', value: player.pas },
    { key: 'DRI', value: player.dri },
    { key: 'DEF', value: player.def },
    { key: 'PHY', value: player.phy },
  ];
  const primary = stats.reduce((m, s) => (s.value > m.value ? s : m), stats[0]);
  return (
    <div className={cn('grid grid-cols-2 gap-1', className)}>
      {stats.map(s => (
        <div key={s.key} className={cn('flex items-center justify-between rounded-md px-2 py-1 text-xs border', s.key === primary.key ? 'bg-primary/5 border-primary/30' : 'border-transparent bg-muted/30')}> 
          <span className="text-muted-foreground">{attributeLabels[s.key]}</span>
          <span className="font-bold">{s.value}</span>
        </div>
      ))}
    </div>
  );
}

export type PlayerPhotoProps = { player: Player; size?: 'compact' | 'standard' | 'profile'; className?: string };
export function PlayerPhoto({ player, size = 'standard', className }: PlayerPhotoProps) {
  const sizeMap = { compact: 'h-16 w-16', standard: 'h-24 w-24', profile: 'h-32 w-32' };
  return (
    <Avatar className={cn(sizeMap[size], 'border-4 shadow-sm object-cover', className)}>
      <AvatarImage
        src={player.photoUrl}
        alt={player.name || 'Jugador'}
        style={{
          objectFit: 'cover',
          objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`,
          transform: `scale(${player.cropZoom || 1})`,
          transformOrigin: 'center center'
        }}
      />
      <AvatarFallback className="font-black text-xl">{(player.name || 'J').charAt(0)}</AvatarFallback>
    </Avatar>
  );
}
