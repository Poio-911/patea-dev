
'use client';

import {
  Dialog,
  DialogContent,
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
                'w-5 h-5',
                i < filledStars
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              )}
            />
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground">Nivel de Equilibrio</p>
      </div>
    );
  };

export function MatchTeamsDialog({ match, children }: MatchTeamsDialogProps) {
  const teams = match.teams || [];
  const balanceMetrics = teams[0]?.balanceMetrics;

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background/80 backdrop-blur-lg rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-foreground">{match.title}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
            {balanceMetrics && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-background/50 p-3">
                    <BalanceRating fairnessPercentage={balanceMetrics.fairnessPercentage} />
                     <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        <span>Diferencia de OVR: {balanceMetrics.ovrDifference.toFixed(2)}</span>
                    </div>
                </div>
            )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.map((team, index) => (
              <Card key={team.name} className={cn("overflow-hidden flex flex-col", index === 0 ? "border-primary" : "border-accent")}>
                <CardHeader className={cn("flex-row items-center justify-between p-3", index === 0 ? "bg-primary/20" : "bg-accent/20")}>
                    <div className="flex items-center gap-2">
                         <Shirt className={cn("h-5 w-5", index === 0 ? 'text-primary' : 'text-accent')} />
                        <UiCardTitle className="text-base font-bold truncate">{team.name}</UiCardTitle>
                    </div>
                  <Badge variant="outline" className={cn("text-sm", index === 0 ? "border-primary text-primary" : "border-accent text-accent")}>
                    <ShieldCheck className="mr-1 h-3 w-3"/>
                    {team.averageOVR.toFixed(1)}
                  </Badge>
                </CardHeader>
                <CardContent className="p-2 flex-grow flex flex-col">
                    <div className="space-y-1 flex-grow">
                        {team.players.map((player) => {
                            const matchPlayer = match.players.find(p => p.uid === player.uid);
                            return (
                                <div key={player.uid} className="flex items-center justify-between p-1.5 rounded-md text-sm hover:bg-muted/50">
                                    <div className="flex items-center gap-2 truncate">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={matchPlayer?.photoUrl} alt={player.displayName} data-ai-hint="player portrait" />
                                            <AvatarFallback className="text-xs">{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="font-medium truncate">{player.displayName}</p>
                                    </div>
                                    <Badge variant="outline" className={cn("text-xs font-bold", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}>
                                        {player.ovr} <span className="ml-1 opacity-75">{player.position}</span>
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>
                  <Separator className="my-2" />
                  <div className="text-xs space-y-1 p-1">
                    <div className='font-semibold'>Formación: {team.suggestedFormation || 'No definida'}</div>
                    <div className="flex flex-wrap gap-1">
                        {team.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
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
