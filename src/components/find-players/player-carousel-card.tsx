'use client';

import { AvailablePlayer } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlayerPositionBadge, PlayerOvr, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/lib/geo-utils';
import { getOvrLevel } from '@/lib/player-utils';

type PlayerCarouselCardProps = {
    player: AvailablePlayer;
    distanceKm: number;
    isActive: boolean;
    onSelect: (uid: string) => void;
    actionSlot?: React.ReactNode;
};

export function PlayerCarouselCard({
    player,
    distanceKm,
    isActive,
    onSelect,
    actionSlot,
}: PlayerCarouselCardProps) {
    const photoUrl = player.photoURL || (player as any).photoUrl || '';
    const level = getOvrLevel(player.ovr);
    const posConfig = positionConfig[player.position];

    return (
        <div
            onClick={() => onSelect(player.uid)}
            className={cn(
                'w-[280px] sm:w-[320px] flex flex-col gap-2 p-3 rounded-xl border bg-card shadow-lg transition-all duration-200 cursor-pointer select-none',
                isActive
                    ? `border-primary ring-2 ring-primary/20 transform -translate-y-1`
                    : 'border-border/80'
            )}
        >
            {/* Header: Avatar + Info */}
            <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                    <div className={cn(
                        "rounded-full p-0.5 border-2",
                        isActive ? `border-glow-${level}` : "border-border/50"
                    )}>
                        <Avatar className="h-12 w-12">
                            <AvatarImage src={photoUrl} alt={player.displayName} className="object-cover" />
                            <AvatarFallback className="text-sm font-bold bg-muted">
                                {(player.displayName || '?').charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border/50">
                        <PlayerOvr value={player.ovr} size="compact" className="scale-75" />
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-sm truncate leading-none">
                            {player.displayName}
                        </span>
                        <PlayerPositionBadge position={player.position} size="xs" />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isFinite(distanceKm) && (
                            <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" />
                                {formatDistance(distanceKm)}
                            </span>
                        )}
                        <span>·</span>
                        <span className="truncate">{posConfig.name}</span>
                    </div>
                </div>
            </div>

            {/* Footer: Action Button (Full Width) */}
            <div className="pt-1">
                {actionSlot ? (
                    <div onClick={(e) => e.stopPropagation()} className="w-full">
                        {actionSlot}
                    </div>
                ) : (
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                        Ver Perfil
                    </Button>
                )}
            </div>
        </div>
    );
}
