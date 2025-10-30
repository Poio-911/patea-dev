'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Match, Team, Player as PlayerType, TeamFormation, FormationSlot } from '@/lib/types';
import { formationsByMatchSize } from '@/lib/formations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, Users, Shuffle, User, MoreVertical, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PitchIcon } from './icons/pitch-icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from './ui/badge';
import { SoccerPlayerIcon } from './icons/soccer-player-icon';

interface TacticalBoardProps {
  match: Match;
}

const TacticalPlayer = ({ player, onOpenMenu }: { player: PlayerType, onOpenMenu: (player: PlayerType, e: React.MouseEvent) => void }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-1 group text-center w-20">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/50 group-hover:bg-primary/30 transition-colors">
                    <SoccerPlayerIcon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground truncate w-full">{player.name}</p>
                <p className="text-xs text-muted-foreground -mt-1">{player.position}</p>
            </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
           <DropdownMenuItem onClick={(e) => onOpenMenu(player, e as unknown as React.MouseEvent)}>
               Mover Jugador
           </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

const assignPlayersToFormation = (players: PlayerType[], formation: Formation): TeamFormation => {
    const formationSlots: TeamFormation = {};
    const availablePlayers = [...players];
    const usedPlayerIds = new Set<string>();

    // First pass: assign players to their preferred positions
    formation.slots.forEach(slot => {
        const positionType = slot.name.substring(0, 3);
        const playerIndex = availablePlayers.findIndex(p => p.position === positionType && !usedPlayerIds.has(p.id));
        
        if (playerIndex !== -1) {
            const [assignedPlayer] = availablePlayers.splice(playerIndex, 1);
            formationSlots[slot.name] = assignedPlayer.id;
            usedPlayerIds.add(assignedPlayer.id);
        }
    });

    // Second pass: fill remaining slots with any available player
    formation.slots.forEach(slot => {
        if (!formationSlots[slot.name] && availablePlayers.length > 0) {
            const [assignedPlayer] = availablePlayers.splice(0, 1);
            formationSlots[slot.name] = assignedPlayer.id;
            usedPlayerIds.add(assignedPlayer.id);
        }
    });

    return formationSlots;
};


export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedFormationName, setSelectedFormationName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [activePlayer, setActivePlayer] = useState<PlayerType | null>(null);
  
  const { toast } = useToast();
  const firestore = useFirestore();

  const allPlayersMap = useMemo(() => new Map(initialMatch.players.map(p => [p.uid, p])), [initialMatch.players]);

  useEffect(() => {
    if (initialMatch.teams) {
      const formationName = initialMatch.teams[0]?.suggestedFormation || 
                               Object.keys(formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize])[0];
      setSelectedFormationName(formationName);
      
      const formation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]?.[formationName];

      if (formation) {
          const teamsWithFormation = initialMatch.teams.map(team => {
              const teamPlayers = team.players.map(p => allPlayersMap.get(p.uid)).filter(p => p) as PlayerType[];
              return {
                  ...team,
                  formation: team.formation && Object.keys(team.formation).length > 0 ? team.formation : assignPlayersToFormation(teamPlayers, formation)
              };
          });
          setTeams(teamsWithFormation);
      } else {
        setTeams(initialMatch.teams);
      }
    }
  }, [initialMatch, allPlayersMap]);
  
  const currentFormation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]?.[selectedFormationName];

  const handleFormationChange = (formationName: string) => {
    setSelectedFormationName(formationName);
    const newFormation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]?.[formationName];
    if (!newFormation) return;

    const newTeams = teams.map(team => {
        const teamPlayers = team.players.map(p => allPlayersMap.get(p.uid)).filter(p => p) as PlayerType[];
        return {
            ...team,
            suggestedFormation: formationName,
            formation: assignPlayersToFormation(teamPlayers, newFormation),
        };
    });
    setTeams(newTeams);
  };
  
  const handleMovePlayer = (playerToMoveId: string, toTeamIndex: number) => {
    const newTeams = JSON.parse(JSON.stringify(teams)) as Team[]; // Deep copy
    
    let fromTeamIndex = -1;
    let playerInfo: PlayerType | undefined;

    // Find the player and their current team
    for (let i = 0; i < newTeams.length; i++) {
        const playerIdx = newTeams[i].players.findIndex(p => p.uid === playerToMoveId);
        if (playerIdx !== -1) {
            fromTeamIndex = i;
            playerInfo = allPlayersMap.get(playerToMoveId);
            break;
        }
    }

    if (fromTeamIndex === -1 || !playerInfo || fromTeamIndex === toTeamIndex) {
        setActivePlayer(null);
        return;
    }
    
    // Remove from source team
    newTeams[fromTeamIndex].players = newTeams[fromTeamIndex].players.filter(p => p.uid !== playerToMoveId);
    
    // Add to target team
    newTeams[toTeamIndex].players.push({
        uid: playerInfo.id,
        displayName: playerInfo.name,
        ovr: playerInfo.ovr,
        position: playerInfo.position
    });

    // Re-assign formations and calculate OVR for both teams
    const formation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]?.[selectedFormationName];
    if (formation) {
      newTeams.forEach((team, index) => {
          const teamPlayers = team.players.map(p => allPlayersMap.get(p.uid)).filter(p => p) as PlayerType[];
          newTeams[index].formation = assignPlayersToFormation(teamPlayers, formation);
          const totalOVR = teamPlayers.reduce((sum, p) => sum + p.ovr, 0);
          newTeams[index].averageOVR = teamPlayers.length > 0 ? totalOVR / teamPlayers.length : 0;
      });
    }

    setTeams(newTeams);
    setActivePlayer(null);
  };

  const handleOpenMenu = (player: PlayerType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePlayer(player);
  };
  
  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const matchRef = doc(firestore, 'matches', initialMatch.id);
      const teamsToSave = teams.map(team => ({
          ...team,
          suggestedFormation: selectedFormationName,
          players: team.players.map(p => ({
              uid: p.uid,
              displayName: p.displayName,
              ovr: p.ovr,
              position: p.position
          }))
      }));
      await updateDoc(matchRef, { teams: teamsToSave });
      toast({ title: 'Tácticas guardadas', description: 'La formación y alineación han sido actualizadas.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudieron guardar las tácticas.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getPlayerInSlot = (team: Team, slotName: string): PlayerType | undefined => {
      const playerId = team.formation?.[slotName];
      if (!playerId) return undefined;
      return allPlayersMap.get(playerId) as PlayerType | undefined;
  };
  
  if (!teams.length || !currentFormation) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
             <h2 className="text-2xl font-bold">Pizarra Táctica</h2>
             <div className="flex gap-2">
                 <Button onClick={handleSave} disabled={isSaving}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                     Guardar
                 </Button>
             </div>
        </div>
        
        {teams.map((team, teamIndex) => {
            const assignedPlayerIds = new Set(Object.values(team.formation || {}));
            const benchPlayers = team.players
                .map(p => allPlayersMap.get(p.uid))
                .filter(p => p && !assignedPlayerIds.has(p.id)) as PlayerType[];

            return (
                <Card key={team.name}>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <CardTitle>{team.name} <Badge variant="secondary">OVR {team.averageOVR.toFixed(1)}</Badge></CardTitle>
                             <div className="flex items-center gap-2">
                               <label htmlFor={`formation-select-${teamIndex}`} className="text-sm font-medium">Formación</label>
                               <Select onValueChange={handleFormationChange} defaultValue={selectedFormationName}>
                                  <SelectTrigger id={`formation-select-${teamIndex}`} className="w-[180px]">
                                    <SelectValue placeholder="Elegir formación" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.values(formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize]).map(f => (
                                      <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                             </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 relative aspect-[7/10] bg-green-700/20 dark:bg-green-900/30 rounded-lg overflow-hidden flex items-center justify-center">
                                <PitchIcon className="w-full h-full text-foreground/20" />
                                {currentFormation.slots.map(slot => {
                                    const player = getPlayerInSlot(team, slot.name);
                                    return (
                                        <div 
                                            key={slot.name}
                                            className="absolute"
                                            style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}
                                        >
                                            {player ? (
                                                 <TacticalPlayer player={player} onOpenMenu={handleOpenMenu}/>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full border-2 border-dashed border-foreground/30 flex items-center justify-center">
                                                    <p className="text-xs font-bold text-muted-foreground">{slot.name}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="md:col-span-1">
                                <h3 className="font-semibold mb-2">Suplentes ({benchPlayers.length})</h3>
                                 <div className="p-4 bg-muted rounded-lg h-full min-h-[200px]">
                                    <div className="grid grid-cols-2 gap-4">
                                        {benchPlayers.map(player => (
                                            player ? <TacticalPlayer key={player.id} player={player} onOpenMenu={handleOpenMenu} /> : null
                                        ))}
                                    </div>
                                 </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        })}

        {activePlayer && (
            <DropdownMenu open={!!activePlayer} onOpenChange={() => setActivePlayer(null)}>
                <DropdownMenuTrigger />
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleMovePlayer(activePlayer.id, 0)}>
                        Mover a {teams[0]?.name || 'Equipo 1'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMovePlayer(activePlayer.id, 1)}>
                        Mover a {teams[1]?.name || 'Equipo 2'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
    </div>
  );
}
