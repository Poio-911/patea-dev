
'use client';

import { useState, useMemo } from 'react';
import type { Match, Team, Player } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, Users, MoreVertical, ArrowLeftRight, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JerseyPreview } from './team-builder/jersey-preview';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface TacticalBoardProps {
  match: Match;
}

const positionBadgeStyles: Record<string, string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

function PlayerItem({ player, onMove, currentTeamName, otherTeam, canMove }: { player: any; onMove: (playerId: string, targetContainer: string) => void; currentTeamName: string; otherTeam: Team | null; canMove: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-background border hover:bg-muted/50">
        <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-9 w-9">
                <AvatarImage src={player.photoUrl} alt={player.displayName} />
                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
                <p className="font-medium truncate">{player.displayName}</p>
                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-xs", positionBadgeStyles[player.position])}>{player.position}</Badge>
                    <Badge variant="secondary" className="text-xs">{player.ovr}</Badge>
                </div>
            </div>
        </div>
        {canMove && (
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {otherTeam && (
                        <DropdownMenuItem onClick={() => onMove(player.uid, otherTeam.name)}>
                            <ArrowLeftRight className="mr-2 h-4 w-4" />
                            Mover a {otherTeam.name}
                        </DropdownMenuItem>
                    )}
                    {currentTeamName !== 'unassigned' && (
                         <DropdownMenuItem onClick={() => onMove(player.uid, 'unassigned')}>
                            <UserX className="mr-2 h-4 w-4" />
                            Mover a Suplentes
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        )}
    </div>
  );
}

export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>(initialMatch.teams || []);
  const [unassignedPlayers, setUnassignedPlayers] = useState<any[]>(() => {
    const assignedPlayerIds = new Set(initialMatch.teams?.flatMap(t => t.players.map(p => p.uid)));
    return initialMatch.players.filter(p => !assignedPlayerIds.has(p.uid));
  });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleMovePlayer = (playerId: string, targetContainer: string) => {
    let playerToMove: any;
    let sourceContainer: string | null = null;
    const newTeams = JSON.parse(JSON.stringify(teams)) as Team[];
    let newUnassigned = [...unassignedPlayers];

    // Find and remove from source
    if (unassignedPlayers.some(p => p.uid === playerId)) {
        sourceContainer = 'unassigned';
        const index = newUnassigned.findIndex(p => p.uid === playerId);
        playerToMove = newUnassigned.splice(index, 1)[0];
    } else {
        for (const team of newTeams) {
            const index = team.players.findIndex(p => p.uid === playerId);
            if (index !== -1) {
                sourceContainer = team.name;
                playerToMove = team.players.splice(index, 1)[0];
                break;
            }
        }
    }

    if (!playerToMove) return;

    // Add to target
    if (targetContainer === 'unassigned') {
        newUnassigned.push(playerToMove);
    } else {
        const teamIndex = newTeams.findIndex(t => t.name === targetContainer);
        if (teamIndex !== -1) {
            newTeams[teamIndex].players.push(playerToMove);
        }
    }

    setTeams(newTeams);
    setUnassignedPlayers(newUnassigned);
  };
  
  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const matchRef = doc(firestore, 'matches', initialMatch.id);
      
      const updatedTeams = teams.map(team => {
        const totalOVR = team.players.reduce((sum, p) => sum + p.ovr, 0);
        return {
            ...team,
            averageOVR: team.players.length > 0 ? totalOVR / team.players.length : 0,
            totalOVR: totalOVR
        };
      });

      await updateDoc(matchRef, { teams: updatedTeams });
      toast({ title: 'Equipos guardados', description: 'La formación táctica ha sido actualizada.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudieron guardar los cambios.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {teams.map((team, index) => {
                const otherTeam = teams.find(t => t.name !== team.name) || null;
                return (
                    <Card key={team.name}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                {team.jersey && <JerseyPreview jersey={team.jersey} size="sm" />}
                                <CardTitle>{team.name}</CardTitle>
                            </div>
                            <Badge variant="secondary">OVR: {team.players.length > 0 ? (team.players.reduce((sum, p) => sum + p.ovr, 0) / team.players.length).toFixed(1) : 0}</Badge>
                        </CardHeader>
                        <CardContent>
                             <ScrollArea className="h-96">
                                <div className="space-y-2 pr-4">
                                {team.players.map(player => {
                                    const matchPlayer = initialMatch.players.find(p => p.uid === player.uid);
                                    return (
                                        <PlayerItem 
                                            key={player.uid} 
                                            player={{...player, ...matchPlayer}} 
                                            onMove={handleMovePlayer} 
                                            currentTeamName={team.name}
                                            otherTeam={otherTeam}
                                            canMove={initialMatch.status === 'upcoming'}
                                        />
                                    );
                                })}
                                </div>
                             </ScrollArea>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Suplentes / No Asignados</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-48">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pr-4">
                        {unassignedPlayers.map(player => {
                            const matchPlayer = initialMatch.players.find(p => p.uid === player.uid);
                            return (
                                <PlayerItem 
                                    key={player.uid} 
                                    player={{...player, ...matchPlayer}} 
                                    onMove={handleMovePlayer} 
                                    currentTeamName="unassigned"
                                    otherTeam={teams[0] || null} // Move to team 1 by default
                                    canMove={initialMatch.status === 'upcoming'}
                                />
                            );
                        })}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
        {initialMatch.status === 'upcoming' && (
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Guardar Formaciones
                </Button>
            </div>
        )}
    </div>
  );
}
