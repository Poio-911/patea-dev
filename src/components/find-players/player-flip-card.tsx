'use client';

import { useState } from 'react';
import type { AvailablePlayer } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlayerPositionBadge, PlayerOvr, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/geo-utils';
import { formatAvailability } from './player-search-card';
import { getOvrLevel, getOvrColorClass, getOvrBorderClass } from '@/lib/player-utils';
import { motion } from 'framer-motion';

type PlayerFlipCardProps = {
  player: AvailablePlayer;
  distanceKm: number;
  isActive: boolean;
  actionSlot?: React.ReactNode;
};

export function PlayerFlipCard({
  player,
  distanceKm,
  isActive,
  actionSlot,
}: PlayerFlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const photoUrl = player.photoURL || (player as any).photoUrl || '';
  const level = getOvrLevel(player.ovr);
  const availabilityText = formatAvailability(player.availability);
  const posConfig = positionConfig[player.position];

  return (
    <div
      className={cn(
        'w-[160px] h-[200px] cursor-pointer select-none',
        isActive && 'scale-105 z-10',
        'transition-transform duration-200'
      )}
      style={{ perspective: 1000 }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 120, damping: 15 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* ── Front Face ── */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl overflow-hidden',
            'bg-card border shadow-md',
            `aura-${level}`,
            isActive && `border-glow-${level}`,
            !isActive && 'border-border'
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex flex-col items-center justify-center h-full gap-1.5 p-2">
            {/* Avatar with border glow */}
            <Avatar
              className={cn(
                'h-12 w-12 shrink-0',
                `border-glow-${level}`
              )}
            >
              <AvatarImage src={photoUrl} alt={player.displayName} />
              <AvatarFallback className="text-lg font-bold">
                {(player.displayName || '?').charAt(0)}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <p className="font-semibold text-[10px] truncate max-w-full text-center leading-tight">
              {player.displayName}
            </p>

            {/* Position + OVR */}
            <div className="flex items-center gap-1">
              <PlayerPositionBadge position={player.position} size="xs" />
              <PlayerOvr value={player.ovr} size="compact" className="scale-90" />
            </div>

            {/* Availability preview */}
            {availabilityText && (
              <p className="text-[9px] text-muted-foreground truncate max-w-full text-center px-0.5 opacity-80 leading-none mt-0.5">
                {availabilityText}
              </p>
            )}

            {/* Distance */}
            {isFinite(distanceKm) && (
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground mt-0.5">
                <MapPin className="h-2 w-2" />
                <span>{formatDistance(distanceKm)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Back Face ── */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl overflow-hidden',
            'bg-card border shadow-md',
            isActive ? `border-glow-${level}` : 'border-border'
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="flex flex-col h-full p-2.5 gap-1.5">
            {/* OVR large */}
            <div className="text-center mt-0.5">
              <PlayerOvr value={player.ovr} size="standard" className="text-3xl" />
              <p className="text-[9px] text-muted-foreground leading-none">Overall</p>
            </div>

            {/* Position with icon + full name */}
            <div className="flex items-center justify-center gap-1">
              <posConfig.Icon className="h-3 w-3" />
              <span className="text-[10px] font-medium">{posConfig.name}</span>
              <PlayerPositionBadge position={player.position} size="xs" />
            </div>

            {/* Availability detailed */}
            {availabilityText && (
              <div className="flex items-start gap-1 text-[9px] text-muted-foreground bg-muted/50 rounded p-1">
                <Clock className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                <span className="leading-tight line-clamp-2">{availabilityText}</span>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="space-y-1.5 pb-0.5">
              {actionSlot && (
                <div onClick={(e) => e.stopPropagation()}>
                  {actionSlot}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
