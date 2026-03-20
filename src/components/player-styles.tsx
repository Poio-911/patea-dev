"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Player, AttributeKey, PlayerPosition } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPlayerPhoto } from '@/lib/player-photo';
import { DelIcon, MedIcon, DefIcon, PorIcon } from './icons/positions';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const positionConfig: Record<PlayerPosition, { name: string; Icon: React.ElementType, badgeClasses: string }> = {
  POR: { name: 'Portero', Icon: PorIcon, badgeClasses: 'bg-card/70 text-foreground border border-border' },
  DEF: { name: 'Defensa', Icon: DefIcon, badgeClasses: 'bg-card/70 text-foreground border border-border' },
  MED: { name: 'Medio', Icon: MedIcon, badgeClasses: 'bg-card/70 text-foreground border border-border' },
  DEL: { name: 'Delantero', Icon: DelIcon, badgeClasses: 'bg-card/70 text-foreground border border-border' },
};

export const getPositionBadgeClasses = (position: PlayerPosition) => positionConfig[position].badgeClasses;

export type PlayerPositionBadgeProps = {
  position: PlayerPosition;
  className?: string;
  showIcon?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  neutral?: boolean; // when true, keep grayscale tokens (for player-cards)
  showFullName?: boolean; // when true, show full name (e.g., "Delantero" instead of "DEL")
  textOnly?: boolean; // when true, render only colored text without badge/background/border
};

export function PlayerPositionBadge({ position, className, showIcon = false, size = 'md', neutral = false, showFullName = false, textOnly = false }: PlayerPositionBadgeProps) {
  const config = positionConfig[position];
  const Icon = config.Icon;

  const sizeClasses = {
    xs: 'text-[9px] px-1 py-0 h-4',
    sm: 'text-[10px] px-1.5 py-0.5 h-5',
    md: 'text-xs px-2.5 py-1 h-7',
    lg: 'text-sm px-3 py-1.5 h-8'
  };

  const textSizeClasses = {
    xs: 'text-[9px]',
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm'
  };

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  // Colored classes using Tailwind tokens (`pos.*`) for all themes
  const coloredClasses: Record<PlayerPosition, string> = {
    DEL: 'bg-pos-del/15 text-pos-del border border-pos-del',
    MED: 'bg-pos-med/15 text-pos-med border border-pos-med',
    DEF: 'bg-pos-def/15 text-pos-def border border-pos-def',
    POR: 'bg-pos-por/15 text-pos-por border border-pos-por',
  };

  // Text-only color classes (just the text color)
  const textColorClasses: Record<PlayerPosition, string> = {
    DEL: 'text-pos-del',
    MED: 'text-pos-med',
    DEF: 'text-pos-def',
    POR: 'text-pos-por',
  };

  const displayText = showFullName ? config.name : position;

  // Text-only mode: render just colored bold text without badge
  if (textOnly) {
    return (
      <span className={cn(
        'font-headline font-bold uppercase',
        textColorClasses[position],
        textSizeClasses[size],
        className
      )}>
        {displayText}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-default">
            <Badge
              variant="secondary"
              className={cn(
                'font-headline font-bold uppercase flex items-center gap-1.5 border-0 hover:brightness-95 transition-all',
                neutral ? config.badgeClasses : coloredClasses[position],
                sizeClasses[size],
                className
              )}
            >
              {showIcon && <Icon className={cn(iconSizes[size])} />}
              {displayText}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-headline font-bold">
          <p>{config.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { getOvrLevel } from '@/lib/player-utils';

export type PlayerOvrProps = { value: number; size?: 'compact' | 'standard'; highlight?: boolean; neutral?: boolean; context?: 'default' | 'card'; className?: string };
export function PlayerOvr({ value, size = 'standard', highlight, neutral = false, context = 'default', className }: PlayerOvrProps) {
  const base = 'font-headline font-bold tabular-nums';
  const level = getOvrLevel(value);
  const levelText: Record<string, string> = {
    elite: 'text-[hsl(var(--ovr-elite))]',
    gold: 'text-[hsl(var(--ovr-gold))]',
    silver: 'text-[hsl(var(--ovr-silver))]',
    bronze: 'text-[hsl(var(--ovr-bronze))]',
  };
  const levelBadge: Record<string, string> = {
    elite: 'border-[hsl(var(--ovr-elite))] text-[hsl(var(--ovr-elite))] bg-[hsl(var(--ovr-elite)/0.12)]',
    gold: 'border-[hsl(var(--ovr-gold))] text-[hsl(var(--ovr-gold))] bg-[hsl(var(--ovr-gold)/0.12)]',
    silver: 'border-[hsl(var(--ovr-silver))] text-[hsl(var(--ovr-silver))] bg-[hsl(var(--ovr-silver)/0.12)]',
    bronze: 'border-[hsl(var(--ovr-bronze))] text-[hsl(var(--ovr-bronze))] bg-[hsl(var(--ovr-bronze)/0.12)]',
  };
  if (size === 'compact') {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'text-xs px-2 py-0.5 font-bold',
          highlight && 'ring-2 ring-primary/40',
          neutral ? undefined : levelBadge[level]
        )}
      >
        {value}
      </Badge>
    );
  }
  return (
    <span className={cn('flex flex-col items-center leading-none', className)}>
      <span
        className={cn(
          base,
          'text-4xl leading-none',
          highlight && 'text-primary',
          neutral ? undefined : levelText[level],
        )}
      >
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">OVR</span>
    </span>
  );
}

const attributeLabels: Record<AttributeKey, string> = { PAC: 'RIT', SHO: 'TIR', PAS: 'PAS', DRI: 'REG', DEF: 'DEF', PHY: 'FIS' };

// Key attributes per position that get highlighted with position color
const positionKeyStats: Record<PlayerPosition, AttributeKey[]> = {
  DEL: ['PAC', 'SHO'],
  MED: ['PAS', 'DRI'],
  DEF: ['DEF', 'PHY'],
  POR: ['DEF', 'PHY'],
};

const positionBarColors: Record<PlayerPosition, string> = {
  DEL: 'bg-pos-del/60',
  MED: 'bg-pos-med/60',
  DEF: 'bg-pos-def/60',
  POR: 'bg-pos-por/60',
};

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
  const keyStats = positionKeyStats[player.position] ?? [];
  const barColor = positionBarColors[player.position];

  return (
    <div className={cn('grid grid-cols-2 gap-1', className)}>
      {stats.map(s => {
        const isTop = s.key === primary.key;
        const isKey = keyStats.includes(s.key);
        const pct = Math.round((s.value / 99) * 100);
        return (
          <div
            key={s.key}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs border',
              isTop ? 'bg-primary/5 border-primary/20' : 'border-transparent bg-muted/30'
            )}
          >
            <span className={cn('w-6 shrink-0', isKey ? positionTextColors[player.position] : 'text-muted-foreground')}>
              {attributeLabels[s.key]}
            </span>
            <div className="flex-1 h-1 rounded-full bg-muted-foreground/15 overflow-hidden">
              <div
                className={cn('h-full rounded-full', isTop ? barColor : 'bg-muted-foreground/30')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-bold w-5 text-right">{s.value}</span>
          </div>
        );
      })}
    </div>
  );
}

const positionTextColors: Record<PlayerPosition, string> = {
  DEL: 'text-pos-del',
  MED: 'text-pos-med',
  DEF: 'text-pos-def',
  POR: 'text-pos-por',
};

// Border classes per OVR tier for PlayerPhoto
const photoBorderClasses: Record<string, string> = {
  bronze: 'border-[hsl(var(--ovr-bronze)/0.6)]',
  silver: 'border-[hsl(var(--ovr-silver)/0.7)]',
  gold: 'border-[hsl(var(--ovr-gold)/0.8)] drop-shadow-[0_0_4px_hsla(43,96%,56%,0.4)]',
  elite: 'border-[rgba(200,210,240,0.88)] drop-shadow-[0_0_8px_rgba(200,210,240,0.60)]',
};

export type PlayerPhotoProps = { player: Player; size?: 'compact' | 'standard' | 'profile'; className?: string };
export function PlayerPhoto({ player, size = 'standard', className }: PlayerPhotoProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const sizeMap = { compact: 'h-16 w-16', standard: 'h-24 w-24', profile: 'h-32 w-32' };
  const pixelSizeMap = { compact: 64, standard: 96, profile: 128 };

  const src = getPlayerPhoto(player as any);
  const name = player.name || 'Jugador';
  const level = getOvrLevel(player.ovr);
  const borderClass = photoBorderClasses[level];
  const borderWidth = 'border-4';

  return (
    <Avatar className={cn(sizeMap[size], borderWidth, 'shadow-sm overflow-hidden bg-muted hover:scale-110 hover:shadow-md transition-all duration-300', borderClass, className)}>
      {src && (
        <Image
          src={src}
          alt={name}
          width={pixelSizeMap[size]}
          height={pixelSizeMap[size]}
          className={cn(
            "h-full w-full transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{
            objectFit: 'cover',
            objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`,
            transform: `scale(${player.cropZoom || 1})`,
            transformOrigin: 'center center'
          }}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
      {!isLoaded && (
        <AvatarFallback className="font-black text-xl absolute inset-0">
          {name.charAt(0)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
