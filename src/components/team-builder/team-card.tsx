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
  const teamPlayerIds = team.members ? team.members.map(m => m.playerId) : [];
  const teamPlayers = players.filter(p => teamPlayerIds.includes(p.id));
  const memberCount = team.members?.length || 0;

  return (
    <Link href={`/groups/teams/${team.id}`} className="block h-full group">
        <Card className="overflow-hidden h-full flex flex-col transition-all duration-300 group-hover:shadow-xl group-hover:border-primary/50">
            <CardHeader className="flex-row items-center justify-between p-4">
                <CardTitle className="text-lg font-bold truncate">{team.name}</CardTitle>
                {isOwner && onEdit && onDelete && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.preventDefault()}>
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.preventDefault()}>
                            {/* La funcionalidad de edición puede ser implementada en el futuro */}
                            <DropdownMenuItem disabled>
                                <Edit className="mr-2 h-4 w-4" /> Editar Nombre
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar Equipo
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar "{team.name}"?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta acción no se puede deshacer. El equipo y su plantel serán eliminados permanentemente.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(team.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </CardHeader>
            <CardContent className="flex-grow flex flex-col items-center justify-center p-4 pt-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32">
                    <JerseyPreview jersey={team.jersey} size="lg" />
                </div>
            </CardContent>
            <CardFooter className="bg-muted/50 p-3 flex-col items-start">
                 <div className="flex items-center justify-between w-full">
                    <div className="flex items-center -space-x-3">
                        {teamPlayers.slice(0, 5).map(player => (
                            <Avatar key={player.id} className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={player.photoUrl} alt={player.name} />
                                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        ))}
                        {teamPlayers.length > 5 && (
                             <Avatar className="h-8 w-8 border-2 border-background">
                                <AvatarFallback>+{teamPlayers.length - 5}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                     <div className="text-right">
                        <p className="text-sm font-bold">{memberCount}</p>
                        <p className="text-xs text-muted-foreground -mt-1">Jugadores</p>
                    </div>
                </div>
            </CardFooter>
        </Card>
    </Link>
  );
}
