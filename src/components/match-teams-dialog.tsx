
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
import { Star, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

type MatchTeamsDialogProps = {
  match: Match;
  children: React.ReactNode;
};

const BalanceRating = ({ fairnessPercentage }: { fairnessPercentage: number }) => {
    const totalStars = 5;
    const filledStars = Math.round((fairnessPercentage / 100) * totalStars);
  
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1">
          {[...Array(totalStars)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                'w-6 h-6',
                i < filledStars
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nivel de Equilibrio</p>
      </div>
    );
  };

export function MatchTeamsDialog({ match, children }: MatchTeamsDialogProps) {
  const teams = match.teams || [];
  
  const fairnessPercentage = match.teams?.[0]?.balanceMetrics?.fairnessPercentage ?? 0;
  
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
        <div className="py-4 space-y-6">
            {fairnessPercentage > 0 && (
                <div className="flex justify-center">
                    <BalanceRating fairnessPercentage={fairnessPercentage} />
                </div>
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
