'use client';

import { useState, useTransition } from 'react';
import type { Player, Team } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { generateTeamsAction } from '@/lib/actions';
import { Swords, Loader2, Users, Scale, Trophy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';

type TeamGeneratorClientProps = {
  allPlayers: Player[];
};

export function TeamGeneratorClient({ allPlayers }: TeamGeneratorClientProps) {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [generatedTeams, setGeneratedTeams] = useState<Team[]>([]);
  const [balanceMetrics, setBalanceMetrics] = useState<{ ovrDifference: number; fairnessPercentage: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handlePlayerSelect = (player: Player, checked: boolean) => {
    setSelectedPlayers((prev) =>
      checked ? [...prev, player] : prev.filter((p) => p.id !== player.id)
    );
  };

  const handleGenerateTeams = () => {
    if (selectedPlayers.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Jugadores insuficientes',
        description: 'Por favor, selecciona al menos 2 jugadores para generar equipos.',
      });
      return;
    }

    startTransition(async () => {
      const result = await generateTeamsAction(selectedPlayers);
      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error,
        });
        setGeneratedTeams([]);
        setBalanceMetrics(null);
      } else {
        // @ts-ignore
        setGeneratedTeams(result.teams);
        // @ts-ignore
        setBalanceMetrics(result.balanceMetrics);
        toast({
          title: '¡Equipos Generados!',
          description: 'La IA ha creado equipos equilibrados para tu partido.',
        });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Seleccionar Jugadores ({selectedPlayers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {allPlayers.map((player) => (
            <div
              key={player.id}
              className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50"
            >
              <Checkbox
                id={`player-${player.id}`}
                onCheckedChange={(checked) => handlePlayerSelect(player, !!checked)}
                checked={selectedPlayers.some(p => p.id === player.id)}
              />
              <Avatar className="h-9 w-9">
                <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <Label htmlFor={`player-${player.id}`} className="flex-1 cursor-pointer">
                <span className="font-semibold">{player.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{player.position} - OVR: {player.ovr}</span>
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="lg:col-span-2 space-y-8">
        <Button onClick={handleGenerateTeams} disabled={isPending || selectedPlayers.length < 2} className="w-full lg:w-auto">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Swords className="mr-2 h-4 w-4" />}
          Generar Equipos Equilibrados
        </Button>
        
        {generatedTeams.length > 0 ? (
          <div className="space-y-4">
             {balanceMetrics && (
                <Card>
                    <CardHeader>
                        <CardTitle>Métricas de Equilibrio</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                            <Scale className="w-6 h-6 text-primary"/>
                            <p className="text-sm text-muted-foreground">Diferencia OVR</p>
                            <p className="text-2xl font-bold">{balanceMetrics.ovrDifference}</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                            <Trophy className="w-6 h-6 text-primary"/>
                            <p className="text-sm text-muted-foreground">Justicia</p>
                            <p className="text-2xl font-bold">{balanceMetrics.fairnessPercentage}%</p>
                        </div>
                        <div className="flex flex-col items-center gap-2 p-4 bg-muted/50 rounded-lg">
                            <Users className="w-6 h-6 text-primary"/>
                            <p className="text-sm text-muted-foreground">Jugadores/Equipo</p>
                            <p className="text-2xl font-bold">{generatedTeams[0].players.length}</p>
                        </div>
                    </CardContent>
                </Card>
            )}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {generatedTeams.map((team) => (
                <Card key={team.name}>
                    <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>{team.name}</CardTitle>
                    <Badge variant="secondary">OVR Prom: {team.averageOVR.toFixed(1)}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                    {team.players.map((player) => (
                        <div key={player.uid} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={allPlayers.find(p=>p.id === player.uid)?.photoUrl} alt={player.displayName} data-ai-hint="player portrait" />
                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{player.displayName}</p>
                            <p className="text-xs text-muted-foreground">{player.position}</p>
                        </div>
                        <p className="ml-auto font-bold text-primary">{player.ovr}</p>
                        </div>
                    ))}
                    <Separator className="my-4"/>
                    <div className="flex justify-between font-bold">
                        <span>OVR Total</span>
                        <span>{team.totalOVR}</span>
                    </div>
                    </CardContent>
                </Card>
                ))}
            </div>
          </div>
        ) : (
            <Alert>
                <Swords className="h-4 w-4" />
                <AlertTitle>Esperando Equipos</AlertTitle>
                <AlertDescription>
                    Selecciona jugadores de la lista y haz clic en "Generar Equipos Equilibrados" para ver la magia.
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
