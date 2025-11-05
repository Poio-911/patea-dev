
'use client';

import type { GroupTeam, DetailedTeamPlayer, Player } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPlayerStatusDialog } from '@/components/set-player-status-dialog';

interface TeamRosterPlayerProps {
    player: DetailedTeamPlayer;
    team: GroupTeam;
    onPlayerUpdate: () => void;
}

const positionBadgeStyles: Record<Player['position'], string> = {
    POR: 'bg-yellow-100 text-yellow-800',
    DEF: 'bg-green-100 text-green-800',
    MED: 'bg-blue-100 text-blue-800',
    DEL: 'bg-red-100 text-red-800',
};


export const TeamRosterPlayer = ({ player, team, onPlayerUpdate }: TeamRosterPlayerProps) => {
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
             <Avatar className="h-16 w-16 border">
              <AvatarImage src={player.photoUrl} alt={player.name} />
              <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Badge className="absolute -bottom-2 -right-2 text-base font-bold rounded-full h-8 w-8 flex items-center justify-center border-2 border-background">
                {player.number}
            </Badge>
        </div>
        <div className="flex flex-col items-center">
            <p className="font-bold truncate w-28 text-sm">{player.name}</p>
            <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="text-xs">{player.ovr}</Badge>
                <Badge variant="outline" className={cn("text-xs", positionBadgeStyles[player.position])}>{player.position}</Badge>
            </div>
        </div>
    </Card>
  );
};
