'use client';

import type { Match } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayerPositionBadge } from '@/components/player-styles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlayersConfirmedProps {
  match: Match;
}

export const PlayersConfirmed = ({ match }: PlayersConfirmedProps) => {
  const confirmedCount = match.players.length;
  const totalNeeded = match.matchSize;
  const isFull = confirmedCount >= totalNeeded;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Jugadores
          </CardTitle>
          <Badge variant={isFull ? 'default' : 'secondary'} className="font-mono">
            {confirmedCount}/{totalNeeded}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {confirmedCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todavia no hay jugadores confirmados
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {match.players.map((player, idx) => (
              <div
                key={`${player.uid}-${idx}`}
                className="flex flex-col items-center gap-1.5 min-w-[60px]"
              >
                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                  <AvatarImage src={player.photoURL} alt={player.displayName} />
                  <AvatarFallback className="text-sm">
                    {player.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="text-[11px] font-medium truncate w-14 leading-tight">
                    {player.displayName.split(' ')[0]}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className={cn(
                      "text-[9px] font-bold uppercase",
                      player.position === 'DEL' && "text-pos-del",
                      player.position === 'MED' && "text-pos-med",
                      player.position === 'DEF' && "text-pos-def",
                      player.position === 'POR' && "text-pos-por",
                    )}>
                      {player.position}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{player.ovr}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
