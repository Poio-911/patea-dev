
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Star, Goal, Shield, TrendingUp } from 'lucide-react';

type PlayerDetailCardProps = {
  player: Player;
};

const positionBackgrounds: Record<Player['position'], string> = {
  DEL: 'bg-red-500/10',
  MED: 'bg-green-500/10',
  DEF: 'bg-blue-500/10',
  POR: 'bg-orange-500/10',
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-red-500',
  MED: 'text-green-500',
  DEF: 'text-blue-500',
  POR: 'text-orange-500',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export function PlayerDetailCard({ player }: PlayerDetailCardProps) {
  const playerName = player.name || 'Jugador';

  return (
    <Card className={cn("overflow-hidden border-2 shadow-lg border-border h-full flex flex-col", positionBackgrounds[player.position])}>
      <CardHeader className="p-4 text-center items-center">
        <Avatar className="h-24 w-24 border-4 border-background mb-2">
          <AvatarImage src={player.photoUrl} alt={playerName} />
          <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
        </Avatar>
        <CardTitle className="text-2xl font-bold font-headline">{playerName}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-lg font-bold", positionColors[player.position])}>
            {player.ovr} OVR
          </Badge>
          <Badge variant="outline" className="text-lg">{player.position}</Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 flex-grow flex flex-col gap-4">
        <div>
            <h4 className="font-bold mb-2 text-center text-muted-foreground">Atributos</h4>
            <div className="w-full grid grid-cols-2 gap-x-6 gap-y-2">
                <Stat label="RIT" value={player.pac} />
                <Stat label="TIR" value={player.sho} />
                <Stat label="PAS" value={player.pas} />
                <Stat label="REG" value={player.dri} />
                <Stat label="DEF" value={player.def} />
                <Stat label="FIS" value={player.phy} />
            </div>
        </div>

        <Separator />
        
        <div>
            <h4 className="font-bold mb-2 text-center text-muted-foreground">Estadísticas</h4>
            <div className="grid grid-cols-2 gap-2">
                 <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                    <Shield className="h-5 w-5 text-muted-foreground mb-1"/>
                    <span className="text-xl font-bold">{player.stats?.matchesPlayed || 0}</span>
                    <span className="text-xs text-muted-foreground">Partidos</span>
                </div>
                <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                    <Goal className="h-5 w-5 text-muted-foreground mb-1"/>
                    <span className="text-xl font-bold">{player.stats?.goals || 0}</span>
                    <span className="text-xs text-muted-foreground">Goles</span>
                </div>
                 <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                    <Star className="h-5 w-5 text-muted-foreground mb-1"/>
                    <span className="text-xl font-bold">{(player.stats?.averageRating || 0).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">Rating Prom.</span>
                </div>
                 <div className="flex flex-col items-center p-2 rounded-md bg-muted/50">
                    <TrendingUp className="h-5 w-5 text-muted-foreground mb-1"/>
                    <span className="text-xl font-bold">?</span>
                    <span className="text-xs text-muted-foreground">Asistencias</span>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

