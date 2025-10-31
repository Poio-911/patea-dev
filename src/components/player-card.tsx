
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MoreVertical, Trash2, Pencil, Zap, Target, Send, Footprints, Shield, Dumbbell } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

type PlayerCardProps = {
  player: Player & { displayName?: string };
  isLink?: boolean;
};

const positionBackgrounds: Record<Player['position'], string> = {
  DEL: 'from-chart-1/20',
  MED: 'from-chart-2/20',
  DEF: 'from-chart-3/20',
  POR: 'from-chart-4/20',
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'text-chart-1',
  MED: 'text-chart-2',
  DEF: 'text-chart-3',
  POR: 'text-chart-4',
};

const statIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  RIT: Zap,
  TIR: Target,
  PAS: Send,
  REG: Footprints,
  DEF: Shield,
  FIS: Dumbbell,
};

const statLabelsLong: Record<string, string> = {
  RIT: 'Ritmo',
  TIR: 'Tiro',
  PAS: 'Pase',
  REG: 'Regate',
  DEF: 'Defensa',
  FIS: 'Físico',
};

const Stat = ({ label, value, isBest }: { label: string; value: number, isBest: boolean }) => {
  const Icon = statIcons[label] || Zap;
  return (
    <div className="flex flex-col gap-1 group" role="group" aria-label={`${statLabelsLong[label]}: ${value} puntos${isBest ? ', mejor estadística' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground/80 group-hover:text-primary transition-colors" aria-hidden="true" />
          <span className="font-semibold text-muted-foreground text-xs">{label}</span>
        </div>
        <span className={cn("font-bold text-sm", isBest && "text-primary")}>{value}</span>
      </div>
      <motion.div whileHover={{ scaleX: 1.05, transition: { duration: 0.2 } }}>
        <Progress value={value} isBest={isBest} aria-hidden="true" />
      </motion.div>
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

  const stats: { label: 'RIT' | 'TIR' | 'PAS' | 'REG' | 'DEF' | 'FIS', value: number }[] = React.useMemo(() => [
    { label: 'RIT', value: player.pac },
    { label: 'TIR', value: player.sho },
    { label: 'PAS', value: player.pas },
    { label: 'REG', value: player.dri },
    { label: 'DEF', value: player.def },
    { label: 'FIS', value: player.phy },
  ], [player.pac, player.sho, player.pas, player.dri, player.def, player.phy]);

  const maxStatValue = React.useMemo(() => Math.max(...stats.map(s => s.value)), [stats]);

  const CardContentComponent = () => (
    <Card
      className="overflow-hidden border-2 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 border-border h-full flex flex-col group"
      role="article"
      aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
    >
      <CardHeader className={cn(
        "relative p-3 text-card-foreground bg-gradient-to-br to-transparent",
        positionBackgrounds[player.position]
      )}>
        <div className="flex justify-between items-start">
          <div className={cn("font-bold leading-none text-4xl sm:text-5xl", positionColors[player.position])}>
            {player.ovr}
          </div>
          <Badge variant="outline" className={cn("text-xs font-bold bg-transparent border-0", positionColors[player.position])}>
            {player.position}
          </Badge>
        </div>
        <div className="relative h-16 sm:h-20 -mt-8 sm:-mt-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-background overflow-hidden group-hover:scale-105 transition-transform duration-300">
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

      <CardContent className="p-3 text-center bg-card flex-grow flex flex-col">
        <div className="mt-2 space-y-2.5 flex-grow">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} isBest={stat.value === maxStatValue} />
          ))}
        </div>

        {/* Quick Stats Footer */}
        <div className="mt-3 pt-3 border-t border-border/50">
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
