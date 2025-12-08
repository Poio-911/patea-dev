
'use client';

import type { Match, Player } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';
import { PlayerOvr, PlayerPhoto, positionConfig, PlayerPositionBadge } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SwapPlayerDialog } from '@/components/swap-player-dialog';
import { AnimatedCardWrapper } from '@/components/animated-card-wrapper';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { getOvrLevel } from '@/lib/player-utils';

interface TeamRosterPlayerProps {
    player: Player;
    match: Match;
    isOwner?: boolean;
    index?: number;
}

export const TeamRosterPlayer = ({ player, match, isOwner = false, index = 0 }: TeamRosterPlayerProps) => {
    const { Icon, textColor } = positionConfig[player.position];
    const ovrLevel = getOvrLevel(player.ovr);
    const staggerDelay = index * 0.03;

    // Find the player in match.teams to get their match-specific info
    const matchPlayer = match.teams
        ?.flatMap(t => t.players)
        .find(p => p.uid === player.id);

    // Find the team this player belongs to in this match
    const playerTeam = match.teams?.find(t =>
        t.players.some(p => p.uid === player.id)
    );

    return (
        <AnimatedCardWrapper animation="slide" delay={staggerDelay}>
            <Card className={cn(
                "flex flex-col items-center text-center p-3 gap-2 transition-shadow relative",
                // NEW: Subtle holographic effect (only on dark theme)
                "game:holo-effect",
                // NEW: Hover effects with shadows by tier (lighter version, only on dark theme)
                "hover:shadow-md",
                ovrLevel === 'elite' && "game:hover:border-purple-500/50 game:hover:shadow-lg game:hover:shadow-purple-500/30",
                ovrLevel === 'gold' && "game:hover:border-yellow-500/50 game:hover:shadow-lg game:hover:shadow-yellow-500/30",
                ovrLevel === 'silver' && "game:hover:border-gray-400/50 game:hover:shadow-lg game:hover:shadow-gray-400/30",
                ovrLevel === 'bronze' && "game:hover:border-amber-700/50 game:hover:shadow-lg game:hover:shadow-amber-700/30",
            )}>
                {/* Swap button */}
                {isOwner && match.status === 'upcoming' && matchPlayer && (
                    <div className="absolute top-1 right-1 z-10">
                        <SwapPlayerDialog match={match} playerToSwap={matchPlayer}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-primary/10"
                                title="Intercambiar jugador"
                            >
                                <ArrowLeftRight className="h-4 w-4" />
                            </Button>
                        </SwapPlayerDialog>
                    </div>
                )}

                {/* NEW: Tiny jersey indicator (only on dark theme) */}
                {playerTeam?.jersey && (
                    <div className="hidden game:block absolute top-1 left-1 opacity-30 z-0">
                        <JerseyPreview jersey={playerTeam.jersey} size="xs" />
                    </div>
                )}

            <div className="relative mt-4">
                <PlayerPhoto player={player as any} size="compact" />
            </div>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5 rounded-full border-2 p-0.5", textColor)} />
                    <p className="font-bold truncate w-24 text-base">{player.name}</p>
                </div>
                <div className="flex items-center justify-center gap-2 mt-1">
                    <PlayerOvr value={player.ovr} size="compact" />
                    <PlayerPositionBadge position={player.position} size="sm" />
                </div>
            </div>
        </Card>
        </AnimatedCardWrapper>
    );
};
