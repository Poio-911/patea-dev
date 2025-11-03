
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
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

export const PlayersConfirmed = ({ match }: PlayersConfirmedProps) => {
    return (
        <Card className="dark:bg-background/20 border-foreground/10 backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Jugadores Confirmados ({match.players.length} / {match.matchSize})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {match.players.map((player, idx) => (
                        <div key={`${player.uid}-${idx}`} className="flex flex-col items-center text-center p-3 gap-2 border border-foreground/10 rounded-lg dark:bg-background/20">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-sm truncate w-24">{player.displayName}</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <Badge variant="outline" className={cn("text-xs dark:bg-background/20 dark:border-foreground/20", positionBadgeStyles[player.position])}>{player.position}</Badge>
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
