
'use client';

import { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from './jersey-preview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MoreVertical } from 'lucide-react';
import Link from 'next/link';

interface TeamCardProps {
  team: GroupTeam;
  players: Player[];
  isOwner: boolean;
  onEdit?: (team: GroupTeam) => void;
  onDelete?: (teamId: string) => void;
}

export function TeamCard({ team, players, isOwner, onEdit, onDelete }: TeamCardProps) {
  const teamPlayers = players.filter(p => team.members.some(m => m.playerId === p.id));

  return (
     <Link href={`/groups/teams/${team.id}`}>
        <Card className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
            <JerseyPreview jersey={team.jersey} size="md" />
            <div>
                <CardTitle className="text-lg">{team.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                <Users className="inline h-3 w-3 mr-1" />
                {team.members.length} jugadores
                </p>
            </div>
            </div>
            {isOwner && onEdit && onDelete && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.preventDefault()}>
                      <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                <DropdownMenuItem onClick={() => onEdit(team)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                        onSelect={e => e.preventDefault()}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                    </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar "{team.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                        Esta acción no se puede deshacer. El equipo será eliminado permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                        onClick={() => onDelete(team.id)}
                        className="bg-destructive hover:bg-destructive/90"
                        >
                        Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
            )}
        </CardHeader>
        <CardContent className="flex-grow">
            <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Jugadores:</p>
            {teamPlayers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin jugadores asignados</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                {teamPlayers.slice(0, 6).map(player => (
                    <div key={player.id} className="flex items-center gap-1.5 text-xs">
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={player.photoUrl} alt={player.name} />
                        <AvatarFallback className="text-[10px]">
                        {player.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                    <span>{player.name.split(' ')[0]}</span>
                    </div>
                ))}
                {teamPlayers.length > 6 && (
                    <span className="text-xs text-muted-foreground">
                    +{teamPlayers.length - 6} más
                    </span>
                )}
                </div>
            )}
            </div>
        </CardContent>
        </Card>
     </Link>
  );
}
