'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Team, Match } from '@/lib/types';

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

interface DroppablePitchZoneProps {
    id: string;
    team: Team;
    teamColor: string;
    initialMatch: Match;
}

export function DroppablePitchZone({ id, team, teamColor, initialMatch }: DroppablePitchZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <SortableContext id={id} items={team.players.map(p => p.uid)} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
            'flex-1 border-2 border-dashed rounded-lg transition-colors p-4 flex flex-wrap gap-4 items-center justify-center',
            isOver ? 'border-primary bg-primary/20' : teamColor,
        )}
      >
        <h3 className="w-full text-center font-bold text-white text-lg drop-shadow-md">{team.name}</h3>
        {team.players.map(player => {
             const matchPlayer = initialMatch.players.find(p => p.uid === player.uid);
             return <SortablePlayerItem key={player.uid} player={{...player, ...matchPlayer}} teamColor={teamColor} />;
        })}
      </div>
    </SortableContext>
  );
}
