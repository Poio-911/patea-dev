
'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle as UiCardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Match, Player } from '@/lib/types';
import { GripVertical, Save, X, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JerseyPreview } from './team-builder/jersey-preview';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Alert, AlertDescription } from '@/components/ui/alert';

type EditableTeamsDialogProps = {
  match: Match;
  children: React.ReactNode;
};

const positionBadgeStyles: Record<Player['position'], string> = {
  DEL: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  MED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  DEF: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  POR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
};

interface SortablePlayerProps {
  player: any;
  matchPlayer?: any;
}

function SortablePlayer({ player, matchPlayer }: SortablePlayerProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.uid,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-2 rounded-md bg-background border-2",
        isDragging ? "border-primary shadow-lg" : "border-transparent hover:bg-muted"
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Avatar className="h-9 w-9">
          <AvatarImage src={matchPlayer?.photoUrl} alt={player.displayName} />
          <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <p className="font-medium">{player.displayName}</p>
      </div>
      <Badge
        variant="outline"
        className={cn("text-sm", positionBadgeStyles[player.position as keyof typeof positionBadgeStyles])}
      >
        {player.ovr} <span className="ml-1 opacity-75">{player.position}</span>
      </Badge>
    </div>
  );
}

export function EditableTeamsDialog({ match, children }: EditableTeamsDialogProps) {
  const [teams, setTeams] = useState(match.teams || []);
  const [activePlayer, setActivePlayer] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const player = teams.flatMap(t => t.players).find(p => p.uid === active.id);
    setActivePlayer(player);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);

    if (!over) return;

    // Find which team the player came from and which team it's going to
    const activePlayerId = active.id as string;
    let sourceTeamIndex = -1;
    let playerIndex = -1;

    teams.forEach((team, teamIdx) => {
      const pIdx = team.players.findIndex(p => p.uid === activePlayerId);
      if (pIdx !== -1) {
        sourceTeamIndex = teamIdx;
        playerIndex = pIdx;
      }
    });

    // Determine target team from the droppable container
    const overTeamId = over.data.current?.sortable?.containerId || over.id;
    const targetTeamIndex = teams.findIndex(t => t.name === overTeamId);

    if (sourceTeamIndex === -1 || targetTeamIndex === -1) return;
    if (sourceTeamIndex === targetTeamIndex) return; // Same team, no change needed

    // Move player between teams
    const newTeams = [...teams];
    const [movedPlayer] = newTeams[sourceTeamIndex].players.splice(playerIndex, 1);
    newTeams[targetTeamIndex].players.push(movedPlayer);

    // Recalculate average OVR for both teams
    newTeams[sourceTeamIndex].averageOVR =
      newTeams[sourceTeamIndex].players.reduce((sum, p) => sum + p.ovr, 0) /
      newTeams[sourceTeamIndex].players.length;

    newTeams[targetTeamIndex].averageOVR =
      newTeams[targetTeamIndex].players.reduce((sum, p) => sum + p.ovr, 0) /
      newTeams[targetTeamIndex].players.length;

    setTeams(newTeams);
  };

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);

    try {
      const matchRef = doc(firestore, 'matches', match.id);
      await updateDoc(matchRef, { teams });

      toast({
        title: '¡Equipos actualizados!',
        description: 'Los cambios en los equipos se guardaron correctamente.',
      });
      setOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: 'No se pudieron guardar los cambios en los equipos.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTeams(match.teams || []);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{match.title} - Editor de Equipos</DialogTitle>
          <DialogDescription>
            Arrastra y suelta jugadores entre equipos para reorganizarlos
          </DialogDescription>
        </DialogHeader>

        <Alert className="my-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Arrastra los jugadores de un equipo a otro para equilibrar las formaciones. El OVR promedio se actualiza automáticamente.
          </AlertDescription>
        </Alert>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {teams.map((team, index) => (
              <Card key={team.name} className="border-2">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      {team.jersey && <JerseyPreview jersey={team.jersey} size="sm" />}
                      <div>
                        <UiCardTitle className="text-lg">{team.name}</UiCardTitle>
                        <Badge variant="secondary" className="mt-1">
                          OVR Promedio: {team.averageOVR.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SortableContext
                    id={team.name}
                    items={team.players.map(p => p.uid)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {team.players.map(player => {
                        const matchPlayer = match.players.find(p => p.uid === player.uid);
                        return (
                          <SortablePlayer
                            key={player.uid}
                            player={player}
                            matchPlayer={matchPlayer}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            ))}
          </div>

          <DragOverlay>
            {activePlayer && (
              <div className="flex items-center gap-3 p-2 rounded-md bg-primary text-primary-foreground shadow-lg">
                <Avatar className="h-9 w-9">
                  <AvatarImage
                    src={match.players.find(p => p.uid === activePlayer.uid)?.photoUrl}
                    alt={activePlayer.displayName}
                  />
                  <AvatarFallback>{activePlayer.displayName.charAt(0)}</AvatarFallback>
                </Avatar>
                <p className="font-medium">{activePlayer.displayName}</p>
                <Badge variant="secondary">{activePlayer.ovr}</Badge>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
