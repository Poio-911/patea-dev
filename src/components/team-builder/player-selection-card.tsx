"use client";
import { useState } from 'react';
import Image from 'next/image';
import { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Check, ShieldAlert } from 'lucide-react';
import { PlayerPositionBadge } from '@/components/player-styles';

interface PlayerSelectionCardProps {
    player: Player;
    isSelected: boolean;
    isMaxedOut: boolean; // If player is already in max teams
    teamCount: number;
    onToggle: (id: string) => void;
    status?: 'titular' | 'suplente';
    onStatusToggle?: () => void;
}

export function PlayerSelectionCard({ player, isSelected, isMaxedOut, teamCount, onToggle, status, onStatusToggle }: PlayerSelectionCardProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    return (
        <div
            onClick={() => (!isMaxedOut || isSelected ? onToggle(player.id) : null)}
            className={cn(
                "group relative cursor-pointer transition-all duration-300 rounded-xl overflow-hidden border-2",
                // Base styles
                "bg-card/80 backdrop-blur-sm",
                // Selected State: Golden/Neon Glow + Border
                isSelected
                    ? "border-primary shadow-lg dark:shadow-[0_0_20px_-5px_rgba(var(--primary),0.6)] scale-105 z-10 bg-primary/5 dark:bg-primary/10"
                    : "border-border/40 dark:border-white/10 hover:border-border/80 dark:hover:border-white/30 hover:bg-muted/20 dark:hover:bg-white/5",
                // Disabled State
                isMaxedOut && !isSelected && "opacity-50 grayscale cursor-not-allowed border-dashed"
            )}
        >
            {/* Selection Indicator */}
            <div className={cn(
                "absolute top-2 right-2 z-20 transition-transform duration-300",
                isSelected ? "scale-100" : "scale-0"
            )}>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/50">
                    <Check className="h-4 w-4" />
                </div>
            </div>

            {/* Maxed Out Indicator (Shield) */}
            {isMaxedOut && !isSelected && (
                <div className="absolute top-2 right-2 z-20">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20 text-destructive" title="Límite de equipos alcanzado">
                        <ShieldAlert className="h-4 w-4" />
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center p-4 gap-3">
                {/* Avatar with Glow Effect */}
                <div className={cn(
                    "relative transition-transform duration-300",
                    isSelected && "scale-110"
                )}>
                    <div className={cn(
                        "absolute inset-0 rounded-full blur-md opacity-0 transition-opacity duration-500",
                        isSelected && "bg-primary opacity-60"
                    )} />
                    <Avatar className="h-16 w-16 border-2 border-white/10 relative z-10 overflow-hidden bg-muted">
                        {player.photoUrl && (
                            <Image
                                src={player.photoUrl}
                                alt={player.name}
                                width={64}
                                height={64}
                                className={cn(
                                    "h-full w-full object-cover transition-opacity duration-300",
                                    isLoaded ? "opacity-100" : "opacity-0"
                                )}
                                onLoad={() => setIsLoaded(true)}
                                loading="lazy"
                            />
                        )}
                        {!isLoaded && (
                            <AvatarFallback className="absolute inset-0">{player.name.charAt(0)}</AvatarFallback>
                        )}
                    </Avatar>
                </div>

                <div className="text-center w-full space-y-1">
                    <p className={cn(
                        "font-bold text-sm truncate transition-colors",
                        isSelected ? "text-primary" : "text-foreground"
                    )}>
                        {player.name}
                    </p>

                    <div className="flex items-center justify-center gap-2">
                        <PlayerPositionBadge position={player.position} showIcon={false} size="xs" />
                        {teamCount > 0 && (
                            <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                                teamCount >= 3 ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border"
                            )}>
                                {teamCount}/3
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* TIT/SUP Status Badge */}
            {isSelected && status && onStatusToggle && (
                <button
                    onClick={(e) => { e.stopPropagation(); onStatusToggle(); }}
                    className={cn(
                        "absolute bottom-1 left-1 text-[9px] font-black px-1.5 py-0.5 rounded leading-tight z-20 transition-colors",
                        status === 'titular'
                            ? "bg-primary/80 text-primary-foreground"
                            : "bg-black/70 text-white/70"
                    )}
                >
                    {status === 'titular' ? 'TIT' : 'SUP'}
                </button>
            )}

            {/* Decoratve Corner Lines */}
            {isSelected && (
                <>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />
                </>
            )}
        </div>
    );
}
