
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
import { Card, CardContent, CardHeader, CardTitle as UiCardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { Match, Player } from '@/lib/types';
import { Star, Scale, ShieldCheck, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';

type MatchTeamsDialogProps = {
  match: Match;
  children: React.ReactNode;
};

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};


export function MatchTeamsDialog({ match, children }: MatchTeamsDialogProps) {
  const teams = match.teams || [];
  
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map((team) => (
              <Card key={team.name}>
                <CardHeader className="flex-row items-center justify-between">
                    <UiCardTitle className="text-lg">{team.name}</UiCardTitle>
                  <Badge variant="secondary">OVR Promedio: {team.averageOVR.toFixed(1)}</Badge>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {team.players.map((player) => {
                            const matchPlayer = match.players.find(p => p.uid === player.uid);
                            return (
                                <div key={player.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={matchPlayer?.photoUrl} alt={player.displayName} data-ai-hint="player portrait" />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-medium">{player.displayName}</p>
                                    </div>
                                    <Badge variant="outline" className={cn("text-sm", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>
                                        {player.ovr} <span className="ml-1 opacity-75">{player.position}</span>
                                    </Badge>
                                </div>
                            );
                        })}
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
