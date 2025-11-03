
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Pencil } from 'lucide-react';
import type { Player, AttributeKey } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EditPlayerDialog } from './edit-player-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFirestore, useUser } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

type PlayerCardProps = {
  player: Player & { displayName?: string };
  isLink?: boolean;
};

const positionStyles: Record<Player['position'], string> = {
  POR: 'text-yellow-600 dark:text-yellow-400',
  DEF: 'text-green-600 dark:text-green-400',
  MED: 'text-blue-600 dark:text-blue-400',
  DEL: 'text-red-600 dark:text-red-400',
};

const getStatColorClasses = (value: number): string => {
  if (value >= 85) return 'text-green-500';
  if (value >= 75) return 'text-blue-500';
  if (value >= 60) return 'text-yellow-600';
  return 'text-red-500';
};

const StatPill = React.memo(({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center justify-between rounded bg-muted/50 px-2 py-0.5 text-xs font-bold">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(getStatColorClasses(value))}>{value}</span>
    </div>
));
StatPill.displayName = 'StatPill';


export const PlayerCard = React.memo(function PlayerCard({ player, isLink = true }: PlayerCardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);

  const playerName = player.name || player.displayName || 'Jugador';
  const isManualPlayer = player.id !== player.ownerUid;
  const canDelete = isManualPlayer && user?.uid === player.ownerUid;
  const canEdit = isManualPlayer && user?.uid === player.ownerUid;

  const handleDelete = async () => {
    if (!firestore || !canDelete) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'players', player.id));
        toast({
            title: "Jugador borrado",
            description: `${playerName} fue eliminado de tu plantel.`
        });
        setIsAlertOpen(false);
    } catch (error) {
        console.error("Error deleting player: ", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo eliminar al jugador."
        });
    } finally {
        setIsDeleting(false);
    }
  };
  
  const stats: { label: string; value: number }[] = [
    { label: 'RIT', value: player.pac },
    { label: 'TIR', value: player.sho },
    { label: 'PAS', value: player.pas },
    { label: 'REG', value: player.dri },
    { label: 'DEF', value: player.def },
    { label: 'FIS', value: player.phy },
  ];

  const CardContentComponent = () => (
    <Card
      className="overflow-hidden shadow-md h-full flex flex-col group transition-all duration-300 hover:shadow-primary/20 hover:border-primary/30"
      role="article"
      aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
    >
      <CardHeader className="relative p-0 text-card-foreground">
        <div className="absolute top-2 right-2 z-10">
          {(canEdit || canDelete) && (
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/80 hover:bg-black/20 hover:text-white"
                    aria-label={`Opciones para ${playerName}`}
                  >
                    <MoreVertical size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEdit && (
                    <EditPlayerDialog player={player}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Pencil className="mr-2 h-4 w-4" />
                        <span>Editar</span>
                      </DropdownMenuItem>
                    </EditPlayerDialog>
                  )}
                  {canDelete && canEdit && <DropdownMenuSeparator />}
                  {canDelete && (
                    <DropdownMenuItem onClick={() => setIsAlertOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Eliminar</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Seguro que querés borrar a {playerName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Vas a borrar al jugador para siempre.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? "Borrando..." : "Sí, borrar"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="aspect-[4/5] relative flex flex-col justify-end items-center text-center p-3 sm:p-4 text-white">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-0"></div>
           <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-background/20 mb-2 shadow-lg transition-transform duration-300 group-hover:scale-110 z-10">
            <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" />
            <AvatarFallback className="text-4xl font-black">{playerName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="z-10">
            <h3 className="text-base sm:text-lg font-bold font-headline truncate">{playerName}</h3>
            {isManualPlayer && <Badge variant="secondary" className="text-xs -mt-1">Manual</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 text-center bg-card flex-grow flex flex-col justify-center">
        <div className="flex items-center justify-center gap-4">
            <span className={cn("text-3xl sm:text-4xl font-black", positionStyles[player.position])}>{player.ovr}</span>
            <Badge variant="outline" className="text-sm font-bold">{player.position}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 my-3 sm:my-4">
            {stats.map((stat) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} />
            ))}
        </div>
      </CardContent>
    </Card>
  );

  if (isLink) {
    return (
        <Link href={`/players/${player.id}`} className="block h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
            <CardContentComponent />
        </Link>
    );
  }

  return <CardContentComponent />;
});
