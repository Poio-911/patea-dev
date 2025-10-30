
'use client';

import { useState, useMemo } from 'react';
import type { Match, Team, Player as PlayerType, TeamFormation } from '@/lib/types';
import { formationsByMatchSize, Formation } from '@/lib/formations';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Save, Users, Shuffle } from 'lucide-react';
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
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { generateTeamsAction } from '@/lib/actions/server-actions';
import { ScrollArea } from './ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PitchIcon } from './icons/pitch-icon';

interface TacticalBoardProps {
  match: Match;
}

const PlayerAvatar = ({ player }: { player: PlayerType | { displayName: string, photoUrl?: string } }) => (
  <div className="flex flex-col items-center gap-1">
    <Avatar className="h-10 w-10 border-2 border-background shadow-md">
      <AvatarImage src={player.photoUrl} alt={player.displayName} />
      <AvatarFallback>{player.displayName?.charAt(0)}</AvatarFallback>
    </Avatar>
    <p className="text-xs font-semibold bg-black/50 text-white px-1.5 py-0.5 rounded">
      {player.displayName}
    </p>
  </div>
);

const DroppableSlot = ({ slotName, player, children }: { slotName: string, player?: PlayerType, children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: slotName });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-1 transition-all',
        isOver && 'scale-110'
      )}
      style={{ left: `${children.props.style.left}`, top: `${children.props.style.top}` }}
    >
      <div className={cn("h-16 w-16 rounded-full flex items-center justify-center transition-colors", player ? 'bg-primary/20' : 'bg-foreground/10 border-2 border-dashed border-foreground/20')}>
        {!player && <p className="text-xs font-bold text-muted-foreground">{slotName}</p>}
      </div>
    </div>
  );
};

export function TacticalBoard({ match: initialMatch }: TacticalBoardProps) {
  const [teams, setTeams] = useState<Team[]>(initialMatch.teams || []);
  const [selectedFormation, setSelectedFormation] = useState<string>(initialMatch.teams?.[0]?.suggestedFormation || Object.keys(formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize])[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleFormationChange = (formationName: string) => {
    setSelectedFormation(formationName);
    // You might want to reset player positions when formation changes
    const newTeams = teams.map(team => ({...team, formation: {}}));
    setTeams(newTeams);
  };
  
  const currentFormation = formationsByMatchSize[initialMatch.matchSize as keyof typeof formationsByMatchSize][selectedFormation];

  const handleDragStart = (event: DragStartEvent) => {
    setActivePlayerId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActivePlayerId(null);
    // Logic to update player positions will go here
  };


  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const matchRef = doc(firestore, 'matches', initialMatch.id);
      
      const updatedTeams = teams.map(team => ({
          ...team,
          suggestedFormation: selectedFormation,
          formation: team.formation || {}
      }));

      await updateDoc(matchRef, { teams: updatedTeams });
      toast({ title: 'Tácticas guardadas', description: 'La formación y alineación han sido actualizadas.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudieron guardar las tácticas.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold">Pizarra Táctica</h2>
                 <div className="flex gap-2">
                     <Button onClick={handleSave} disabled={isSaving}>
                         {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                         Guardar Formaciones
                     </Button>
                 </div>
            </div>

            {teams.map((team, teamIndex) => (
                <Card key={team.name}>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <CardTitle>{team.name}</CardTitle>
                             <div className="flex items-center gap-2">
                               <label htmlFor={`formation-select-${teamIndex}`} className="text-sm font-medium">Formación</label>
                               <Select onValueChange={handleFormationChange} defaultValue={selectedFormation}>
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
                            <div className="md:col-span-2 relative aspect-[7/10] bg-green-600 rounded-lg overflow-hidden flex items-center justify-center">
                                <PitchIcon className="w-full h-full text-white/20" />
                                 {currentFormation.slots.map(slot => (
                                    <div key={slot.name} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2">
                                         <div className="h-16 w-16 rounded-full flex items-center justify-center bg-black/10 border-2 border-dashed border-white/20">
                                            <p className="text-xs font-bold text-white/70">{slot.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2">Suplentes</h3>
                                 <div className="p-4 bg-muted rounded-lg h-full min-h-[200px]">
                                    {/* Bench players will go here */}
                                 </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    </DndContext>
  );
}
