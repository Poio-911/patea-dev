
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
                {/* Swap button — only for non-team matches (manual/collaborative) */}
                {isOwner && match.status === 'upcoming' && matchPlayer &&
                    (match.type === 'manual' || match.type === 'collaborative') && (
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

                {/* Captain Badge for Inter-Group */}
                {match.type === 'intergroup_friendly' && match.captains?.includes(player.id) && (
                    <div className="absolute top-1 right-1 z-10 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                        <span>C</span>
                    </div>
                )}


                <div className="relative mt-4">
                    <PlayerPhoto player={player as any} size="compact" />
                </div>
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                        <p className="font-bold truncate max-w-full text-base">{player.name}</p>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-1">
                        <PlayerOvr value={player.ovr} size="compact" />
                        <PlayerPositionBadge position={player.position} size="sm" showIcon={false} textOnly={true} />
                    </div>
                </div>
            </Card>
        </AnimatedCardWrapper>
    );
};
