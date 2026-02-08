'use client';

import type { AvailablePlayer, DayOfWeek, TimeOfDay } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlayerPositionBadge } from '@/components/player-styles';
import { PlayerOvr } from '@/components/player-styles';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/geo-utils';

const dayShortLabels: Record<DayOfWeek, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mie',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
};

const timeLabels: Record<TimeOfDay, string> = {
  mañana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
};

export function formatAvailability(availability: AvailablePlayer['availability']): string {
  if (!availability) return '';
  const days = Object.keys(availability) as DayOfWeek[];
  if (days.length === 0) return '';

  const dayStr = days.map((d) => dayShortLabels[d] || d).join(', ');

  const allTimes = new Set<TimeOfDay>();
  days.forEach((d) => {
    availability[d]?.forEach((t) => allTimes.add(t));
  });
  const timeStr = Array.from(allTimes)
    .map((t) => timeLabels[t] || t)
    .join(', ');

  return timeStr ? `${dayStr} · ${timeStr}` : dayStr;
}

type PlayerSearchCardProps = {
  player: AvailablePlayer;
  distanceKm: number;
  isActive: boolean;
  onSelect: (uid: string) => void;
  actionSlot?: React.ReactNode;
};

export function PlayerSearchCard({
  player,
  distanceKm,
  isActive,
  onSelect,
  actionSlot,
}: PlayerSearchCardProps) {
  const photoUrl = player.photoURL || (player as any).photoUrl || '';
  const availabilityText = formatAvailability(player.availability);

  return (
    <div
      id={`card-${player.uid}`}
      onClick={() => onSelect(player.uid)}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border bg-card cursor-pointer transition-all duration-200',
        isActive
          ? 'border-primary ring-2 ring-primary/20 scale-[1.01]'
          : 'border-border hover:border-primary/30 hover:bg-muted/30'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-10 w-10 shrink-0 border">
        <AvatarImage src={photoUrl} alt={player.displayName} />
        <AvatarFallback className="text-sm font-bold">
          {(player.displayName || '?').charAt(0)}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{player.displayName}</span>
          <PlayerPositionBadge position={player.position} size="sm" />
        </div>
        {availabilityText && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {availabilityText}
          </p>
        )}
      </div>

      {/* OVR */}
      <PlayerOvr value={player.ovr} size="compact" />

      {/* Distance */}
      {isFinite(distanceKm) && (
        <div className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
          <MapPin className="h-3 w-3" />
          <span>{formatDistance(distanceKm)}</span>
        </div>
      )}

      {/* Action slot (invite button) */}
      {actionSlot && <div className="shrink-0">{actionSlot}</div>}
    </div>
  );
}
