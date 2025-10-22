
'use client';

import type { Player } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface TeamRosterPlayerProps {
    player: Player;
    number: number;
}

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


export const TeamRosterPlayer = ({ player, number }: TeamRosterPlayerProps) => {
  return (
    <Card className="flex flex-col items-center text-center p-3 gap-2 hover:shadow-md transition-shadow">
        <div className="relative">
             <Avatar className="h-16 w-16 border">
              <AvatarImage src={player.photoUrl} alt={player.name} />
              <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Badge className="absolute -bottom-2 -right-2 text-base font-bold rounded-full h-8 w-8 flex items-center justify-center border-2 border-background">
                {number}
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

