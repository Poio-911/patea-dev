'use client';

import { GroupTeam, Player } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JerseyPreview } from './jersey-preview';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, Users, Eye } from 'lucide-react';
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
  // Defensive coding: Check for `team.members` and fallback to `team.playerIds` (old structure)
  const teamPlayerIds = team.members ? team.members.map(m => m.playerId) : (team as any).playerIds || [];
  const teamPlayers = players.filter(p => teamPlayerIds.includes(p.id));
  const memberCount = team.members?.length || (team as any).playerIds?.length || 0;

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
                  {memberCount} jugadores
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
          <CardContent className="flex-grow min-h-[4rem]">
            <div className="flex -space-x-2 overflow-hidden">
                {teamPlayers.slice(0, 7).map(player => (
                    <Avatar key={player.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                        <AvatarImage src={player.photoUrl} alt={player.name} />
                        <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                ))}
                {teamPlayers.length > 7 && (
                    <Avatar className="inline-block h-8 w-8 rounded-full ring-2 ring-background">
                        <AvatarFallback>+{teamPlayers.length - 7}</AvatarFallback>
                    </Avatar>
                )}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/50 p-3">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 w-full justify-center">
                  <Eye className="h-3 w-3" />
                  Ver Plantel Completo
              </p>
          </CardFooter>
        </Card>
     </Link>
  );
}
