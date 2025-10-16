import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WandSparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AISuggestionDialog } from './ai-suggestion-dialog';

type PlayerCardProps = {
  player: Player;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'bg-chart-1',
  MED: 'bg-chart-2',
  DEF: 'bg-chart-3',
  POR: 'bg-chart-4',
};

const positionBorderColors: Record<Player['position'], string> = {
    DEL: 'border-chart-1',
    MED: 'border-chart-2',
    DEF: 'border-chart-3',
    POR: 'border-chart-4',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export function PlayerCard({ player }: PlayerCardProps) {
  return (
    <Card className={cn("overflow-hidden border-2 shadow-lg transition-transform hover:scale-105 hover:shadow-xl", positionBorderColors[player.position])}>
      <div className={cn("p-2 text-white", positionColors[player.position])}>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{player.ovr}</div>
          <div className="text-sm font-semibold">{player.position}</div>
        </div>
      </div>
      <CardContent className="p-4 text-center">
        <Avatar className="mx-auto -mt-10 h-20 w-20 border-4 border-card">
          <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <h3 className="mt-2 text-lg font-bold font-headline">{player.name}</h3>
        
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          <Stat label="RIT" value={player.pac} />
          <Stat label="TIR" value={player.sho} />
          <Stat label="PAS" value={player.pas} />
          <Stat label="REG" value={player.dri} />
          <Stat label="DEF" value={player.def} />
          <Stat label="FIS" value={player.phy} />
        </div>

        <AISuggestionDialog player={player}>
          <Button variant="outline" size="sm" className="mt-4 w-full">
            <WandSparkles className="mr-2 h-4 w-4" />
            Consejos IA
          </Button>
        </AISuggestionDialog>
      </CardContent>
    </Card>
  );
}
