'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Pencil, Star, Goal, TrendingUp } from 'lucide-react';
import type { Player } from '@/lib/types';
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

type PlayerCardProps = {
  player: Player & { displayName?: string };
  isLink?: boolean;
};

const positionStyles: Record<Player['position'], { color: string; bg: string; name: string; primaryAttr: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy' }> = {
  POR: { name: 'Portero', color: 'text-yellow-600', bg: 'from-yellow-500/20', primaryAttr: 'def' },
  DEF: { name: 'Defensa', color: 'text-green-600', bg: 'from-green-500/20', primaryAttr: 'def' },
  MED: { name: 'Volante', color: 'text-blue-600', bg: 'from-blue-500/20', primaryAttr: 'pas' },
  DEL: { name: 'Delantero', color: 'text-red-600', bg: 'from-red-500/20', primaryAttr: 'sho' },
};

const getStatColor = (value: number) => {
    if (value >= 85) return 'bg-green-500/80 text-white';
    if (value >= 70) return 'bg-blue-500/80 text-white';
    if (value >= 50) return 'bg-yellow-500/80 text-yellow-950';
    return 'bg-muted text-muted-foreground';
};

const StatPill = ({ label, value, isPrimary, index }: { label: string; value: number; isPrimary: boolean; index: number }) => {
    const colorClass = getStatColor(value);

    return (
        <motion.div
            className={cn(
                "flex items-center justify-between rounded-lg p-2 text-xs font-bold",
                colorClass,
                isPrimary && 'ring-2 ring-offset-2 ring-offset-card ring-amber-400'
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
        >
            <span>{label}</span>
            <span>{value}</span>
        </motion.div>
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
  
  const stats: { label: 'RIT' | 'TIR' | 'PAS' | 'REG' | 'DEF' | 'FIS', value: number, key: 'pac' | 'sho' | 'pas' | 'dri' | 'def' | 'phy' }[] = React.useMemo(() => [
    { label: 'RIT', value: player.pac, key: 'pac' },
    { label: 'TIR', value: player.sho, key: 'sho' },
    { label: 'PAS', value: player.pas, key: 'pas' },
    { label: 'REG', value: player.dri, key: 'dri' },
    { label: 'DEF', value: player.def, key: 'def' },
    { label: 'FIS', value: player.phy, key: 'phy' },
  ], [player.pac, player.sho, player.pas, player.dri, player.def, player.phy]);


  const CardContentComponent = () => (
    <Card
      className="overflow-hidden border-2 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 border-border h-full flex flex-col group"
      role="article"
      aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
    >
      <CardHeader className={cn(
        "relative p-3 text-card-foreground bg-gradient-to-br to-transparent",
        positionStyles[player.position].bg
      )}>
        <div className="flex justify-between items-start">
          <div className={cn("font-bold leading-none text-5xl", positionStyles[player.position].color)}>
            {player.ovr}
          </div>
          <Badge variant="outline" className={cn("text-xs font-bold bg-transparent border-0", positionStyles[player.position].color)}>
            {player.position}
          </Badge>
        </div>
        <div className="relative h-20 -mt-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Avatar className="h-24 w-24 border-4 border-background overflow-hidden group-hover:scale-105 transition-transform duration-300">
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
              <AvatarFallback className="text-4xl">{playerName.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          {(canEdit || canDelete) && (
            <div className="absolute top-0 right-0">
              <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 text-muted-foreground hover:bg-white/20"
                      aria-label={`Opciones para ${playerName}`}
                    >
                      <MoreVertical size={20} />
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
            </div>
          )}
        </div>
        <div className="mt-2 text-center">
            <h3 className="text-lg font-bold font-headline truncate">{playerName}</h3>
            {isManualPlayer && (
              <Badge variant="outline" className="mt-1 text-xs border-dashed">
                Manual
              </Badge>
            )}
        </div>
      </CardHeader>

      <CardContent className="p-3 text-center bg-card flex-grow flex flex-col justify-center">
         <div className="grid grid-cols-2 gap-2 my-2">
            {stats.map((stat, index) => (
                <StatPill 
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    isPrimary={stat.key === positionStyles[player.position].primaryAttr}
                    index={index}
                />
            ))}
        </div>
        <div className="mt-auto pt-3 border-t">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col items-center">
              <span className="font-bold text-base text-foreground">{player.stats.matchesPlayed}</span>
              <span className="text-muted-foreground">Partidos</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-base text-foreground">{player.stats.goals}</span>
              <span className="text-muted-foreground">Goles</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-bold text-base text-foreground">
                {player.stats.averageRating > 0 ? player.stats.averageRating.toFixed(1) : '-'}
              </span>
              <span className="text-muted-foreground">Rating</span>
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