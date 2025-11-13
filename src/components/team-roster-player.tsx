'use client';

import type { GroupTeam, DetailedTeamPlayer, Player, PlayerPosition } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { PlayerOvr, getPositionBadgeClasses, PlayerPhoto } from '@/components/player-styles';
import { Button } from '@/components/ui/button';
import { SetPlayerStatusDialog } from '@/components/set-player-status-dialog';
import { DelIcon, MedIcon, DefIcon, PorIcon } from '@/components/icons/positions';

interface TeamRosterPlayerProps {
    player: DetailedTeamPlayer;
    team: GroupTeam;
    onPlayerUpdate: () => void;
}

const positionBadgeStyles: Record<Player['position'], string> = {
    POR: getPositionBadgeClasses('POR'),
    DEF: getPositionBadgeClasses('DEF'),
    MED: getPositionBadgeClasses('MED'),
    DEL: getPositionBadgeClasses('DEL'),
};

const positionIconAndColor: Record<PlayerPosition, { Icon: React.ElementType, colorClass: string }> = {
    DEL: { Icon: DelIcon, colorClass: 'border-red-500 text-red-500' },
    MED: { Icon: MedIcon, colorClass: 'border-blue-500 text-blue-500' },
    DEF: { Icon: DefIcon, colorClass: 'border-green-500 text-green-500' },
    POR: { Icon: PorIcon, colorClass: 'border-yellow-500 text-yellow-500' },
};


export const TeamRosterPlayer = ({ player, team, onPlayerUpdate }: TeamRosterPlayerProps) => {
  const { Icon, colorClass } = positionIconAndColor[player.position];
    
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
                <Icon className={cn("h-5 w-5 rounded-full border-2 p-0.5", colorClass)} />
                <p className="font-bold truncate w-24 text-base">{player.name}</p>
            </div>
                        <div className="flex items-center justify-center gap-2 mt-1">
                            <PlayerOvr value={player.ovr} size="compact" />
                            <Badge variant="outline" className={cn('text-[10px] font-semibold', positionBadgeStyles[player.position])}>{player.position}</Badge>
                        </div>
        </div>
    </Card>
  );
};
