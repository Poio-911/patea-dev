
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Pencil, Star, Goal } from 'lucide-react';
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
import { motion } from 'framer-motion';
import { playerSpecialties } from '@/lib/data';

type PlayerCardProps = {
  player: Player & { displayName?: string };
  isLink?: boolean;
};

const positionStyles: Record<Player['position'], { color: string; bg: string; name: string; border: string; }> = {
  POR: { name: 'Portero', color: 'text-yellow-400', border: 'border-yellow-400', bg: 'bg-yellow-500' },
  DEF: { name: 'Defensa', color: 'text-green-400', border: 'border-green-400', bg: 'bg-green-500' },
  MED: { name: 'Volante', color: 'text-blue-400', border: 'border-blue-400', bg: 'bg-blue-500' },
  DEL: { name: 'Delantero', color: 'text-red-400', border: 'border-red-400', bg: 'bg-red-500' },
};


const StatPill = ({ label, value, isPrimary, position }: { label: string; value: number; isPrimary: boolean; position: Player['position'] }) => {
    const positionClass = positionStyles[position];

    return (
        <div
            className={cn(
                "relative flex items-center justify-between rounded-lg p-2 text-xs font-bold border-2 bg-background/30",
                "transition-all duration-200",
                positionClass.border,
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-black", positionClass.color)}>
                {value}
            </span>
            {isPrimary && <div className="stat-border-glow" />}
        </div>
    );
};

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
  
  const stats = React.useMemo<{ label: string; value: number; key: AttributeKey }[]>(() => [
    { label: 'RIT', value: player.pac, key: 'PAC' },
    { label: 'TIR', value: player.sho, key: 'SHO' },
    { label: 'PAS', value: player.pas, key: 'PAS' },
    { label: 'REG', value: player.dri, key: 'DRI' },
    { label: 'DEF', value: player.def, key: 'DEF' },
    { label: 'FIS', value: player.phy, key: 'PHY' },
  ], [player.pac, player.sho, player.pas, player.dri, player.def, player.phy]);

  const primaryStat = React.useMemo(() => {
    return stats.reduce((max, stat) => (stat.value > max.value ? stat : max), stats[0]);
  }, [stats]);
  
  const positionClass = positionStyles[player.position];

  const CardContentComponent = () => (
    <Card
      className={cn(
        "overflow-hidden h-full flex flex-col group border-2",
        "transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:border-primary/30 active:scale-[0.98]",
        "bg-card text-card-foreground shadow-lg"
      )}
      role="article"
      aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
    >
      <div className={cn("relative p-3 h-24 text-white", positionClass.bg)}>
        <div className="flex justify-between items-start">
            <div className="flex items-baseline gap-1">
              <span className="font-black leading-none text-5xl drop-shadow-md">
                {player.ovr}
              </span>
              <span className="font-bold leading-none text-lg opacity-80">{player.position}</span>
            </div>

            {(canEdit || canDelete) && (
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white/20"
                      aria-label={`Opciones para ${playerName}`}
                    >
                      <MoreVertical size={18} />
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
      </div>
      
      <CardContent className="flex-grow flex flex-col p-3 pt-0 bg-card">
        <div className="relative -mt-12 z-10 text-center">
             <Avatar className={cn(
              "h-20 w-20 mx-auto",
              "border-4 border-background shadow-lg",
              "transition-transform duration-300 group-hover:scale-110",
            )}>
              <AvatarImage
                src={player.photoUrl}
                alt={playerName}
                data-ai-hint="player portrait"
                style={{
                  objectFit: 'cover',
                  objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`,
                  transform: `scale(${player.cropZoom || 1})`,
                  transformOrigin: 'center center',
                }}
              />
              <AvatarFallback className="text-3xl font-black">
                {playerName.charAt(0)}
              </AvatarFallback>
            </Avatar>
        </div>

        <div className="text-center mt-2 flex-grow flex flex-col">
          <h3 className="text-base font-bold font-headline truncate">{playerName}</h3>
          
          <div className="grid grid-cols-2 gap-1.5 my-3">
            {stats.map((stat) => (
                <StatPill
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    isPrimary={stat.key === primaryStat.key}
                    position={player.position}
                />
            ))}
          </div>

          <div className="mt-auto pt-2 border-t text-xs">
            <div className="grid grid-cols-3 gap-1">
                <div className="flex flex-col items-center">
                <span className="font-bold text-sm text-foreground">{player.stats.matchesPlayed}</span>
                <span className="text-muted-foreground">Partidos</span>
                </div>
                <div className="flex flex-col items-center">
                <span className="font-bold text-sm text-foreground">{player.stats.goals}</span>
                <span className="text-muted-foreground">Goles</span>
                </div>
                <div className="flex flex-col items-center">
                <span className="font-bold text-sm text-foreground">
                    {player.stats.averageRating > 0 ? player.stats.averageRating.toFixed(1) : '-'}
                </span>
                <span className="text-muted-foreground">Rating</span>
                </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLink) {
    return (
        <Link
          href={`/players/${player.id}`}
          className="block h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
          aria-label={`Ver perfil completo de ${playerName}`}
        >
            <CardContentComponent />
        </Link>
    );
  }

  return <CardContentComponent />;
});

    