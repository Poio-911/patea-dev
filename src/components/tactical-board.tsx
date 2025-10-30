
'use client';

import { useState, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Match, Team, Player } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, Users, Shuffle } from 'lucide-react';
import { DroppablePitchZone } from './droppable-pitch-zone';

interface TacticalBoardProps {
  match: Match;
}

const positionBadgeStyles: Record<string, string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

function SortablePlayerItem({ player, teamColor }: { player: any, teamColor: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: player.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    borderColor: teamColor,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative p-1 rounded-full bg-background border-2 shadow-lg w-14 h-14 flex items-center justify-center cursor-grab active:cursor-grabbing">
        <Avatar className="h-12 w-12">
            <AvatarImage src={player.photoUrl} alt={player.displayName} />
            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <Badge className="absolute -bottom-1 -right-1 text-[9px] px-1 h-4 border-2 border-background font-bold">{player.ovr}</Badge>
    </div>
  );
}

export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>(initialMatch.teams || []);
  const [unassignedPlayers, setUnassignedPlayers] = useState<any[]>(() => {
    const assignedPlayerIds = new Set(initialMatch.teams?.flatMap(t => t.players.map(p => p.uid)));
    return initialMatch.players.filter(p => !assignedPlayerIds.has(p.uid));
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );
  
  const allPlayerIds = useMemo(() => teams.flatMap(t => t.players.map(p => p.uid)).concat(unassignedPlayers.map(p => p.uid)), [teams, unassignedPlayers]);

  const findContainer = (id: string) => {
    if (unassignedPlayers.some(p => p.uid === id)) return 'unassigned';
    for (const team of teams) {
      if (team.players.some(p => p.uid === id)) return team.name;
    }
    return null;
  };
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const sourceContainer = findContainer(active.id as string);
    const targetContainer = over.data.current?.sortable?.containerId || over.id;
    
    if (!sourceContainer || !targetContainer || sourceContainer === targetContainer) return;
    
    let playerToMove: any;
    let newTeams = [...teams];
    let newUnassigned = [...unassignedPlayers];

    // Remove from source
    if (sourceContainer === 'unassigned') {
        const index = newUnassigned.findIndex(p => p.uid === active.id);
        playerToMove = newUnassigned.splice(index, 1)[0];
    } else {
        const teamIndex = newTeams.findIndex(t => t.name === sourceContainer);
        const index = newTeams[teamIndex].players.findIndex(p => p.uid === active.id);
        playerToMove = newTeams[teamIndex].players.splice(index, 1)[0];
    }

    // Add to target
    if (targetContainer === 'unassigned') {
        newUnassigned.push(playerToMove);
    } else {
        const teamIndex = newTeams.findIndex(t => t.name === targetContainer);
        newTeams[teamIndex].players.push(playerToMove);
    }

    // Update state
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
  
  const activePlayer = useMemo(() => {
    if (!activeId) return null;
    return initialMatch.players.find(p => p.uid === activeId);
  }, [activeId, initialMatch.players]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
                 <div className="relative aspect-[7/5] bg-green-700 bg-[url('/pitch-texture.svg')] bg-blend-multiply rounded-lg p-4 flex flex-col justify-between border-4 border-white/50">
                    {/* Zones for each team */}
                    {teams.map((team, index) => (
                        <DroppablePitchZone key={team.name} id={team.name} team={team} teamColor={index === 0 ? 'border-blue-400' : 'border-red-400'} initialMatch={initialMatch} />
                    ))}
                 </div>
            </div>
            <div className="lg:col-span-1 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Suplentes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SortableContext id="unassigned" items={unassignedPlayers.map(p => p.uid)} strategy={rectSortingStrategy}>
                            <div className="min-h-[100px] p-2 bg-muted/50 rounded-lg flex flex-wrap gap-2">
                                {unassignedPlayers.map(player => {
                                    const matchPlayer = initialMatch.players.find(p => p.uid === player.uid);
                                    return <SortablePlayerItem key={player.uid} player={{ ...player, ...matchPlayer}} teamColor="border-gray-400" />;
                                })}
                            </div>
                        </SortableContext>
                    </CardContent>
                </Card>
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Guardar Formaciones
                </Button>
            </div>
        </div>
      <DragOverlay>
        {activePlayer ? (
            <div className="relative p-1 rounded-full bg-background border-2 shadow-lg w-14 h-14 flex items-center justify-center border-primary ring-2 ring-primary">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={activePlayer.photoUrl} alt={activePlayer.displayName} />
                    <AvatarFallback>{activePlayer.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <Badge className="absolute -bottom-1 -right-1 text-[9px] px-1 h-4 border-2 border-background font-bold">{activePlayer.ovr}</Badge>
            </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
