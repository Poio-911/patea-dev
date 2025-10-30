'use client';

import { useState, useMemo } from 'react';
import type { Match, Team, Player as PlayerType, Formation } from '@/lib/types';
import { formationsByMatchSize } from '@/lib/formations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, MoreVertical, Repeat, Users, Shirt, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { SwapPlayerDialog } from './swap-player-dialog';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

interface TacticalBoardProps {
  match: Match;
}

const positionOrder: PlayerType['position'][] = ['POR', 'DEF', 'MED', 'DEL'];

const positionBadgeStyles: Record<PlayerType['position'], string> = {
  DEL: 'text-red-600 border-red-600/50 bg-red-500/10',
  MED: 'text-green-600 border-green-600/50 bg-green-500/10',
  DEF: 'text-blue-600 border-blue-600/50 bg-blue-500/10',
  POR: 'text-orange-600 border-orange-600/50 bg-orange-500/10',
};

const TacticalPlayer = ({ player, onOpenMenu }: { player: PlayerType, onOpenMenu: () => void }) => (
    <div className="flex flex-col items-center text-center gap-1 w-24">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button className="relative group">
                    <SoccerPlayerIcon className="w-10 h-10 text-primary group-hover:scale-110 transition-transform" />
                    <div className="absolute top-0 right-0 -mt-1 -mr-1">
                        <MoreVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
                    </div>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={onOpenMenu}>
                    Cambiar Jugador
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        <p className="text-xs font-bold text-foreground/80 uppercase truncate w-full">{player.name}</p>
        <p className={cn("text-[10px] font-semibold uppercase px-1 rounded", positionBadgeStyles[player.position])}>{player.position}</p>
    </div>
);

export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>(initialMatch.teams || []);
  const [formation, setFormation] = useState<Formation>(Object.values(formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize])[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [swapState, setSwapState] = useState<{ player: PlayerType; fromTeamIndex: number } | null>(null);

  const { toast } = useToast();
  const firestore = useFirestore();
  const allPlayersMap = useMemo(() => new Map(initialMatch.players.map(p => [p.uid, { ...p, id: p.uid, name: p.displayName } as PlayerType])), [initialMatch.players]);

  const { teamPlayers, benchPlayers } = useMemo(() => {
    const teamPlayerLists = teams.map(team =>
      team.players.map(p => allPlayersMap.get(p.uid)).filter((p): p is PlayerType => !!p)
        .sort((a, b) => positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position))
    );
    const assignedPlayerIds = new Set(teamPlayerLists.flat().map(p => p.id));
    const bench = Array.from(allPlayersMap.values()).filter(p => !assignedPlayerIds.has(p.id));
    return { teamPlayers: teamPlayerLists, benchPlayers: bench };
  }, [teams, allPlayersMap]);

  const handleFormationChange = (formationName: string) => {
    const newFormation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]?.[formationName];
    if (newFormation) {
      setFormation(newFormation);
    }
  };

  const handleOpenSwapDialog = (player: PlayerType, fromTeamIndex: number) => {
    setSwapState({ player, fromTeamIndex });
  };
  
  const handleConfirmSwap = (targetPlayerId: string) => {
    if (!swapState) return;

    const { player: playerA, fromTeamIndex } = swapState;
    let targetTeamIndex = -1;
    let targetIsOnBench = false;

    // Find where the target player is
    teams.forEach((team, index) => {
        if (team.players.some(p => p.uid === targetPlayerId)) {
            targetTeamIndex = index;
        }
    });
    if (targetTeamIndex === -1) {
        targetIsOnBench = benchPlayers.some(p => p.id === targetPlayerId);
    }
    
    const newTeams = JSON.parse(JSON.stringify(teams));
    
    // Remove player A from its original team
    newTeams[fromTeamIndex].players = newTeams[fromTeamIndex].players.filter((p: any) => p.uid !== playerA.id);

    // If target is another player on a team
    if (!targetIsOnBench && targetTeamIndex !== -1) {
        const playerB = allPlayersMap.get(targetPlayerId);
        if (!playerB) return;
        // Remove player B from its team
        newTeams[targetTeamIndex].players = newTeams[targetTeamIndex].players.filter((p: any) => p.uid !== playerB.id);
        // Add player A to player B's team
        newTeams[targetTeamIndex].players.push(playerA);
        // Add player B to player A's original team
        newTeams[fromTeamIndex].players.push(playerB);
    } else { // If target is a sub
        newTeams[fromTeamIndex].players.push(allPlayersMap.get(targetPlayerId)!);
    }
    
    // Recalculate OVRs
    newTeams.forEach((team: Team) => {
        const teamPlayers = team.players.map(p => allPlayersMap.get(p.uid)).filter(Boolean) as PlayerType[];
        const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
        team.averageOVR = teamPlayers.length > 0 ? totalOVR / teamPlayers.length : 0;
    });

    setTeams(newTeams);
    setSwapState(null);
  };


  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const matchRef = doc(firestore, 'matches', initialMatch.id);
      const teamsToSave = teams.map(team => ({
        ...team,
        suggestedFormation: formation.name,
        players: team.players.map(p => ({
          uid: p.uid,
          displayName: p.displayName,
          ovr: p.ovr,
          position: p.position
        }))
      }));
      await updateDoc(matchRef, { teams: teamsToSave });
      toast({ title: 'Tácticas guardadas', description: 'La alineación ha sido actualizada.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudieron guardar las tácticas.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-2">
          <Label htmlFor="formation-select" className="text-sm font-medium">Formación:</Label>
          <Select onValueChange={handleFormationChange} defaultValue={formation.name}>
            <SelectTrigger id="formation-select" className="w-[180px]">
              <SelectValue placeholder="Elegir formación" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]).map(f => (
                <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Formaciones
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {teams.map((team, teamIndex) => (
          <Card key={team.name}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{team.name}</CardTitle>
              <Badge variant="secondary">OVR {team.averageOVR.toFixed(1)}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(teamPlayers[teamIndex] || []).map(player => (
                  <TacticalPlayer
                    key={player.id}
                    player={player}
                    onOpenMenu={() => handleOpenSwapDialog(player, teamIndex)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {benchPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Suplentes ({benchPlayers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {benchPlayers.map(player => (
              <TacticalPlayer key={player.id} player={player} onOpenMenu={() => {
                  toast({title: "Función no disponible", description: "Los suplentes no se pueden cambiar desde aquí por ahora."});
              }} />
            ))}
          </CardContent>
        </Card>
      )}

      {swapState && (
        <SwapPlayerDialog
            open={!!swapState}
            onOpenChange={() => setSwapState(null)}
            playerToSwap={swapState.player}
            swapTargets={[
                ...teamPlayers.flat().filter(p => p.id !== swapState.player.id),
                ...benchPlayers,
            ]}
            onConfirmSwap={handleConfirmSwap}
            isSubmitting={false}
        />
      )}
    </div>
  );
}
