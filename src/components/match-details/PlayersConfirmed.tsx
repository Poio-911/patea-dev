
'use client';

import type { Match } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface PlayersConfirmedProps {
  match: Match;
}

const positionBadgeStyles: Record<string, string> = {
  DEL: 'bg-chart-1 text-white',
  MED: 'bg-chart-2 text-white',
  DEF: 'bg-chart-3 text-white',
  POR: 'bg-chart-4 text-white',
};

export const PlayersConfirmed = ({ match }: PlayersConfirmedProps) => {
    return (
        <Card className="bg-card/60 backdrop-blur-sm border-2">
            <CardHeader>
                <CardTitle className="text-xl font-semibold">Jugadores Confirmados ({match.players.length} / {match.matchSize})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {match.players.map((player, idx) => (
                        <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border border-foreground/10 rounded-lg bg-card/60 hover:bg-background/40 hover:-translate-y-1 transition-all duration-300">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <Badge className={cn("text-xs", positionBadgeStyles[player.position])}>{player.position}</Badge>
                                    <Badge variant="secondary">{player.ovr}</Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
