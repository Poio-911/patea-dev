'use client';

import { AvailablePlayer } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlayerPositionBadge, PlayerOvr, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/geo-utils';
import { formatAvailability } from './player-search-card';
import { getOvrLevel, getOvrColorClass } from '@/lib/player-utils';

type PlayerListCardProps = {
    player: AvailablePlayer;
    distanceKm: number;
    isActive: boolean;
    onSelect: (uid: string) => void;
    actionSlot?: React.ReactNode;
    variant?: 'default' | 'compact';
};

export function PlayerListCard({
    player,
    distanceKm,
    isActive,
    onSelect,
    actionSlot,
    variant = 'default',
}: PlayerListCardProps) {
    const photoUrl = player.photoURL || (player as any).photoUrl || '';
    const level = getOvrLevel(player.ovr);
    const availabilityText = formatAvailability(player.availability);
    const posConfig = positionConfig[player.position];

    return (
        <div
            onClick={() => onSelect(player.uid)}
            className={cn(
                'group relative flex items-center gap-3 p-3 rounded-xl border bg-card transition-all duration-200 cursor-pointer',
                isActive
                    ? `border-primary ring-1 ring-primary/20 shadow-md`
                    : 'border-border hover:border-primary/30 hover:shadow-sm'
            )}
        >
            {/* Selection Line (active state) */}
            {isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
            )}

            {/* Avatar Section */}
            <div className={cn("relative shrink-0", isActive && "pl-1.5")}>
                <div className={cn(
                    "rounded-full p-0.5 border-2",
                    isActive ? `border-glow-${level}` : "border-transparent"
                )}>
                    <Avatar className="h-14 w-14">
                        <AvatarImage src={photoUrl} alt={player.displayName} className="object-cover" />
                        <AvatarFallback className="text-base font-bold bg-muted/50">
                            {(player.displayName || '?').charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                </div>

                {/* OVR Badge - Floating over Avatar */}
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border/50">
                    <PlayerOvr value={player.ovr} size="compact" className="scale-90" />
                </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-base truncate text-foreground leading-none">
                        {player.displayName}
                    </span>
                    {/* Position */}
                    <PlayerPositionBadge position={player.position} size="xs" />
                </div>

                {/* Distance & Availability */}
                <div className="flex flex-col gap-0.5">
                    {/* Distance */}
                    {isFinite(distanceKm) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{formatDistance(distanceKm)}</span>
                            <span className="text-border mx-1">|</span>
                            <span className="text-xs text-muted-foreground/80 font-medium">
                                {posConfig.name}
                            </span>
                        </div>
                    )}

                    {/* Availability */}
                    {availabilityText && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70 truncate mt-0.5">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{availabilityText}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Button Section (Always Visible) */}
            <div className="shrink-0 pl-2">
                {actionSlot ? (
                    <div onClick={(e) => e.stopPropagation()}>
                        {actionSlot}
                    </div>
                ) : (
                    <Button size="sm" variant="ghost" className="h-8">Ver Perfil</Button>
                )}
            </div>
        </div>
    );
}
