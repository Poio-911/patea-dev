
'use client';

import { useState, useMemo } from 'react';
import type { Match, Team, Player as PlayerType } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, Users, Shuffle, MoreVertical } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { generateTeamsAction } from '@/lib/actions/server-actions';
import { ScrollArea } from './ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';


interface TacticalBoardProps {
  match: Match;
}


export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>(initialMatch.teams || []);
  const [unassignedPlayers, setUnassignedPlayers] = useState<PlayerType[]>(() => {
    const assignedPlayerIds = new Set(initialMatch.teams?.flatMap(t => t.players.map(p => p.uid)));
    return initialMatch.players.filter(p => !assignedPlayerIds.has(p.uid)).map(p => ({
        ...p,
        id: p.uid,
        name: p.displayName
    } as PlayerType));
  });

  const [activePlayer, setActivePlayer] = useState<PlayerType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  const movePlayer = (playerId: string, targetTeamName: string) => {
    const playerToMove = teams.flatMap(t => t.players).find(p => p.uid === playerId) || unassignedPlayers.find(p => p.id === playerId);
    if (!playerToMove) return;

    let newTeams = JSON.parse(JSON.stringify(teams)) as Team[];
    let newUnassigned = [...unassignedPlayers];

    // Remove from source
    newTeams = newTeams.map(team => ({
        ...team,
        players: team.players.filter(p => p.uid !== playerId),
    }));
    newUnassigned = newUnassigned.filter(p => p.id !== playerId);

    // Add to target
    if (targetTeamName === 'unassigned') {
        newUnassigned.push(playerToMove as PlayerType);
    } else {
        const teamIndex = newTeams.findIndex(t => t.name === targetTeamName);
        if (teamIndex !== -1) {
            newTeams[teamIndex].players.push(playerToMove);
        }
    }

    setTeams(newTeams);
    setUnassignedPlayers(newUnassigned);
  };
  
  const handleShuffleTeams = async () => {
    if (!firestore || !initialMatch || !initialMatch.players) return;
    setIsShuffling(true);

    try {
        const playersToBalance = initialMatch.players.map(p => ({
            id: p.uid,
            name: p.displayName,
            position: p.position,
            ovr: p.ovr,
        } as PlayerType));
        
        const result = await generateTeamsAction(playersToBalance);

        if ('error' in result) throw new Error(result.error);
        if (!result.teams) throw new Error('No se generaron equipos');

        setTeams(result.teams);
        setUnassignedPlayers([]);
        
        toast({ title: "¡Equipos Sorteados!", description: "La IA ha creado nuevos equipos." });

    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "No se pudieron volver a sortear los equipos."});
    } finally {
        setIsShuffling(false);
    }
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
            players: team.players.map(({id, name, ...rest}) => rest), // Remove temp 'id' and 'name' fields before saving
            averageOVR: team.players.length > 0 ? totalOVR / team.players.length : 0,
            totalOVR: totalOVR,
        };
      });
      
      const updatedMatchData = {
          teams: updatedTeams,
      };

      await updateDoc(matchRef, updatedMatchData);
      toast({ title: 'Equipos guardados', description: 'La distribución de jugadores ha sido actualizada.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudieron guardar los cambios.' });
    } finally {
      setIsSaving(false);
    }
  };

  const otherTeams = (currentTeamName: string) => teams.filter(t => t.name !== currentTeamName);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const allPlayers = [...teams.flatMap(t => t.players), ...unassignedPlayers];
    const player = allPlayers.find(p => (p.uid || p.id) === active.id) as PlayerType | undefined;
    if (player) {
      setActivePlayer(player);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);

    if (over && active.id !== over.id) {
        const targetTeamName = typeof over.id === 'string' && over.id.startsWith('team-droppable-')
            ? over.id.replace('team-droppable-', '')
            : over.data?.current?.sortable?.containerId;
        
        if (targetTeamName) {
            movePlayer(active.id as string, targetTeamName);
        }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Pizarra Táctica</h2>
                 <div className="flex gap-2">
                    <Button onClick={handleShuffleTeams} variant="outline" disabled={isShuffling}>
                        {isShuffling && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        <Shuffle className="mr-2 h-4 w-4" />
                        Sortear Equipos (IA)
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        Guardar Cambios
                    </Button>
                 </div>
            </div>
           
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {teams.map(team => (
                    <Card key={team.name} id={`team-droppable-${team.name}`}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{team.name}</CardTitle>
                                <Badge variant="secondary">OVR Promedio: {(team.players.reduce((s, p) => s + p.ovr, 0) / (team.players.length || 1)).toFixed(1)}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                             <ScrollArea className="h-72">
                                <div className="space-y-2 pr-4">
                                {team.players.map(player => (
                                    <div key={player.uid} className="flex items-center justify-between p-2 rounded-md bg-background border hover:bg-muted">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarImage src={(initialMatch.players.find(p => p.uid === player.uid) as any)?.photoUrl} alt={player.displayName} />
                                                <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <p className="font-medium">{player.displayName}</p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                {otherTeams(team.name).map(otherTeam => (
                                                    <DropdownMenuItem key={otherTeam.name} onClick={() => movePlayer(player.uid, otherTeam.name)}>
                                                        Mover a {otherTeam.name}
                                                    </DropdownMenuItem>
                                                ))}
                                                <DropdownMenuItem onClick={() => movePlayer(player.uid, 'unassigned')}>
                                                    Mover a Suplentes
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card id="team-droppable-unassigned">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Suplentes / No Asignados ({unassignedPlayers.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-48">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 pr-4">
                            {unassignedPlayers.map(player => (
                                <div key={player.id} className="p-2 rounded-md bg-background border hover:bg-muted">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={player.photoUrl} alt={player.name} />
                                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <p className="text-sm font-medium truncate">{player.name}</p>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                {teams.map(team => (
                                                    <DropdownMenuItem key={team.name} onClick={() => movePlayer(player.id, team.name)}>
                                                        Mover a {team.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
        <DragOverlay>
            {activePlayer ? (
              <div className="flex items-center gap-3 p-2 rounded-md bg-primary text-primary-foreground shadow-lg">
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={(initialMatch.players.find(p => p.uid === activePlayer.id) as any)?.photoUrl}
                    alt={activePlayer.name}
                  />
                  <AvatarFallback>{activePlayer.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-medium">{activePlayer.name}</p>
                <Badge variant="secondary">{activePlayer.ovr}</Badge>
              </div>
            ) : null}
        </DragOverlay>
    </DndContext>
  );
}
