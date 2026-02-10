'use client';

import { AvailablePlayer } from '@/lib/types';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PlayerPositionBadge, PlayerOvr, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { MapPin, ChevronRight } from 'lucide-react';
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
                'relative overflow-hidden w-[280px] sm:w-[320px] flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-300 cursor-pointer select-none group',
                isActive
                    ? `border-primary bg-primary/10 ring-2 ring-primary/20 -translate-y-1 shadow-[0_0_20px_rgba(var(--primary),0.2)]`
                    : 'border-border/60 bg-card/60 backdrop-blur-md hover:bg-card/80 hover:border-border shadow-sm'
            )}
        >
            {/* Glow Effect Top Left */}
            <div className={cn(
                "absolute -top-12 -left-12 w-24 h-24 blur-[40px] rounded-full pointer-events-none opacity-40 transition-opacity",
                isActive ? `bg-glow-${level} opacity-60` : "bg-primary/5"
            )} />

            {/* Header: Avatar + Info */}
            <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                    <div className={cn(
                        "rounded-full p-0.5 border-2 transition-colors duration-300",
                        isActive ? `border-glow-${level}` : "border-border/30"
                    )}>
                        <Avatar className="h-14 w-14 border border-border/10">
                            <AvatarImage src={photoUrl} alt={player.displayName} className="object-cover" />
                            <AvatarFallback className="text-lg font-bold bg-muted/80 backdrop-blur-sm">
                                {(player.displayName || '?').charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-background/90 backdrop-blur-sm rounded-full p-1 shadow-md border border-border/20">
                        <PlayerOvr value={player.ovr} size="compact" className="scale-90" />
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-base truncate leading-none group-hover:text-primary transition-colors">
                            {player.displayName}
                        </span>
                        <PlayerPositionBadge position={player.position} size="xs" />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        {isFinite(distanceKm) && (
                            <span className="flex items-center gap-1 text-primary">
                                <MapPin className="h-3.5 w-3.5" />
                                {formatDistance(distanceKm)}
                            </span>
                        )}
                        <span className="opacity-30">•</span>
                        <span className="truncate">{posConfig.name}</span>
                    </div>
                </div>
            </div>

            {/* Footer Action */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3">
                {actionSlot ? (
                    <div onClick={(e) => e.stopPropagation()} className="w-full">
                        {actionSlot}
                    </div>
                ) : (
                    <>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                            Perfil Jugador
                        </span>
                        <Button size="sm" variant={isActive ? "default" : "secondary"} className="h-8 text-xs font-bold rounded-full group-hover:scale-105 transition-transform">
                            Ver Detalles
                            <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
