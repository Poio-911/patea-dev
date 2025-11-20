
'use client';

import type { Match, Player } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ArrowLeftRight } from 'lucide-react';
import { PlayerOvr, getPositionBadgeClasses, PlayerPhoto, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SwapPlayerDialog } from '@/components/swap-player-dialog';

interface TeamRosterPlayerProps {
    player: Player;
    match: Match;
    isOwner?: boolean;
}

export const TeamRosterPlayer = ({ player, match, isOwner = false }: TeamRosterPlayerProps) => {
  const { Icon, textColor } = positionConfig[player.position];

  // Find the player in match.teams to get their match-specific info
  const matchPlayer = match.teams
    ?.flatMap(t => t.players)
    .find(p => p.uid === player.id);

  return (
    <Card className="flex flex-col items-center text-center p-3 gap-2 hover:shadow-md transition-shadow relative">
        {isOwner && match.status === 'upcoming' && matchPlayer && (
            <div className="absolute top-1 right-1">
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
                <Badge variant="outline" className={cn('text-[10px] font-semibold font-headline', getPositionBadgeClasses(player.position))}>{player.position}</Badge>
            </div>
        </div>
    </Card>
  );
};
