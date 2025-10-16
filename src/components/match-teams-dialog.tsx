
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { Match } from '@/lib/types';
import { Scale, Trophy, Users } from 'lucide-react';

type MatchTeamsDialogProps = {
  match: Match;
  children: React.ReactNode;
};

export function MatchTeamsDialog({ match, children }: MatchTeamsDialogProps) {
  const teams = match.teams || [];
  
  const balanceMetrics = match.teams?.[0]?.balanceMetrics;

  const ovrDifference = balanceMetrics?.ovrDifference ?? 0;
  const fairnessPercentage = balanceMetrics?.fairnessPercentage ?? 100;
  
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Equipos para "{match.title}"</DialogTitle>
          <DialogDescription>
            Equipos generados por IA para un partido equilibrado.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {balanceMetrics && (
              <Card>
                  <CardHeader>
                      <CardTitle>Métricas de Equilibrio</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                          <Scale className="w-6 h-6 text-primary"/>
                          <p className="text-sm text-muted-foreground">Diferencia OVR</p>
                          <p className="text-2xl font-bold">{ovrDifference}</p>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                          <Trophy className="w-6 h-6 text-primary"/>
                          <p className="text-sm text-muted-foreground">Justicia</p>
                          <p className="text-2xl font-bold">{fairnessPercentage.toFixed(0)}%</p>
                      </div>
                      <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                          <Users className="w-6 h-6 text-primary"/>
                          <p className="text-sm text-muted-foreground">Jugadores/Equipo</p>
                          <p className="text-2xl font-bold">{teams.length > 0 ? teams[0].players.length : 0}</p>
                      </div>
                  </CardContent>
              </Card>
            )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {teams.map((team) => (
              <Card key={team.name}>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>{team.name}</CardTitle>
                  <Badge variant="secondary">OVR Prom: {team.averageOVR.toFixed(1)}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {team.players.map((player) => (
                    <div key={player.uid} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                         <AvatarImage src={match.players.find(p => p.uid === player.uid)?.photoUrl} alt={player.displayName} data-ai-hint="player portrait" />
                        <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{player.displayName}</p>
                        <p className="text-xs text-muted-foreground">{player.position}</p>
                      </div>
                      <p className="ml-auto font-bold text-primary">{player.ovr}</p>
                    </div>
                  ))}
                  <Separator className="my-4" />
                  <div className="flex justify-between font-bold">
                    <span>OVR Total</span>
                    <span>{team.totalOVR}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
