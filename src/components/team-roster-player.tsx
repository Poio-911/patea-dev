
'use client';

import type { GroupTeam, DetailedTeamPlayer, Player, PlayerPosition } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { PlayerOvr, getPositionBadgeClasses, PlayerPhoto, positionConfig } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SetPlayerStatusDialog } from '@/components/set-player-status-dialog';

interface TeamRosterPlayerProps {
    player: DetailedTeamPlayer;
    team: GroupTeam;
    onPlayerUpdate: () => void;
}

export const TeamRosterPlayer = ({ player, team, onPlayerUpdate }: TeamRosterPlayerProps) => {
  const { Icon, textColor } = positionConfig[player.position];
    
  return (
    <Card className="flex flex-col items-center text-center p-3 gap-2 hover:shadow-md transition-shadow relative">
        <div className="absolute top-1 right-1">
            <SetPlayerStatusDialog player={player} team={team} onPlayerUpdate={onPlayerUpdate}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </SetPlayerStatusDialog>
        </div>

                <div className="relative mt-4">
                    <PlayerPhoto player={player as any} size="compact" />
                    <Badge className="absolute -bottom-2 -right-2 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center border-2 border-background">
                        {player.number}
                    </Badge>
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
