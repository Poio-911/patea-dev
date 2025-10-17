
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
import { Star, Scale, ShieldCheck, Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

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
  const balanceMetrics = teams[0]?.balanceMetrics; // Assuming metrics are the same for all teams
  
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">Equipos para "{match.title}"</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-6">
            {balanceMetrics && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-muted/50 p-4">
                    <BalanceRating fairnessPercentage={balanceMetrics.fairnessPercentage} />
                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Scale className="h-4 w-4" />
                        <span>Diferencia de OVR: {balanceMetrics.ovrDifference.toFixed(2)}</span>
                    </div>
                </div>
            )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {teams.map((team, index) => (
              <Card key={team.name} className={cn("overflow-hidden", index === 0 ? "border-primary" : "border-accent")}>
                <CardHeader className={cn("flex-row items-center justify-between p-4", index === 0 ? "bg-primary/10" : "bg-accent/10")}>
                    <div className="flex items-center gap-3">
                         <Shirt className={cn("h-6 w-6", index === 0 ? 'text-primary' : 'text-accent')} />
                        <CardTitle className="text-xl">{team.name}</CardTitle>
                    </div>
                  <Badge variant="outline" className={cn("text-base", index === 0 ? "border-primary text-primary" : "border-accent text-accent")}>
                    <ShieldCheck className="mr-1.5 h-4 w-4"/>
                    {team.averageOVR.toFixed(1)} OVR
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <div className="space-y-2">
                        {team.players.map((player) => {
                            const matchPlayer = match.players.find(p => p.uid === player.uid);
                            return (
                                <div key={player.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={matchPlayer?.photoUrl} alt={player.displayName} data-ai-hint="player portrait" />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold text-sm">{player.displayName}</p>
                                            <p className="text-xs text-muted-foreground">{player.position}</p>
                                        </div>
                                    </div>
                                    <p className="ml-auto font-bold text-sm text-foreground/80">{player.ovr}</p>
                                </div>
                            );
                        })}
                    </div>
                  <Separator />
                  <div className="text-xs space-y-2">
                    <div className='font-semibold'>Formación: {team.suggestedFormation || 'No definida'}</div>
                    <div className="flex flex-wrap gap-1.5">
                        {team.tags?.map(tag => (
                            <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                    </div>
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
