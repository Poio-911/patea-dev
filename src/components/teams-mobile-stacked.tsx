import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JerseyPreview } from '@/components/team-builder/jersey-preview';
import { PlayerOvr } from '@/components/player-styles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface Team {
  name: string;
  jersey?: any;
  averageOVR: number;
  imageUrl?: string; // imagen real del equipo
  players: Array<{
    uid: string;
    displayName: string;
    ovr: number;
    position: string;
    photoUrl?: string;
  }>;
}

interface TeamsMobileStackedProps {
  teams: Team[];
}

export function TeamsMobileStacked({ teams }: TeamsMobileStackedProps) {
  const [tab, setTab] = React.useState(teams[0]?.name || '');
  // Colores para la posición
  const posColor = (pos: string) => {
    switch (pos) {
      case 'DEL': return 'text-pos-del';
      case 'MED': return 'text-pos-med';
      case 'DEF': return 'text-pos-def';
      case 'POR': return 'text-pos-por';
      default: return 'text-muted-foreground';
    }
  };
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full flex" data-vaul-no-drag>
        {teams.map((team) => (
          <TabsTrigger
            key={team.name}
            value={team.name}
            className="flex-1 text-xs select-none touch-manipulation"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {team.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {teams.map((team) => (
        <TabsContent
          key={team.name}
          value={team.name}
          className="w-full"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Card className="rounded-2xl shadow-md border-2 mt-2">
            <CardHeader className="flex flex-col items-center gap-1 pb-1 min-h-0 py-1">
              {team.imageUrl ? (
                <img src={team.imageUrl} alt={team.name} className="w-24 h-24 object-cover rounded-xl mb-1" />
              ) : team.jersey ? (
                <div className="flex justify-center w-full mb-1"><JerseyPreview jersey={team.jersey} size="sm" /></div>
              ) : null}
              <span className="font-bold text-[15px] leading-tight truncate text-center w-full">{team.name}</span>
              <Badge variant="secondary" className="mt-0.5 w-fit text-[11px] px-1.5 py-0.5 mx-auto">OVR: {team.averageOVR.toFixed(1)}</Badge>
            </CardHeader>
            <CardContent className="pt-0 pb-1">
              <div className="flex flex-col gap-1">
                {team.players.map((player) => (
                  <div key={player.uid} className="flex flex-row items-center px-1 py-1 rounded bg-muted/40">
                    <Avatar className="h-8 w-8 mr-2">
                      {player.photoUrl ? (
                        <AvatarImage src={player.photoUrl} alt={player.displayName} />
                      ) : (
                        <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="truncate font-medium text-[13px] text-left">
                        {player.displayName} - <span className="font-normal">{player.ovr}</span>
                      </span>
                      <span className={`font-bold text-[11px] ${posColor(player.position)}`}>{
                        player.position === 'DEL' ? 'Delantero' :
                          player.position === 'MED' ? 'Mediocampista' :
                            player.position === 'DEF' ? 'Defensor' :
                              player.position === 'POR' ? 'Arquero' : player.position
                      }</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
