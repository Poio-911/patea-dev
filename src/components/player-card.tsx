
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

const positionStyles: Record<Player['position'], { color: string; bg: string; name: string; primaryAttr: AttributeKey }> = {
  POR: { name: 'Portero', color: 'text-yellow-600 dark:text-yellow-400', bg: 'from-yellow-500/20 dark:from-yellow-400/30', primaryAttr: 'DEF' },
  DEF: { name: 'Defensa', color: 'text-green-600 dark:text-green-400', bg: 'from-green-500/20 dark:from-green-400/30', primaryAttr: 'DEF' },
  MED: { name: 'Volante', color: 'text-blue-600 dark:text-blue-400', bg: 'from-blue-500/20 dark:from-blue-400/30', primaryAttr: 'PAS' },
  DEL: { name: 'Delantero', color: 'text-red-600 dark:text-red-400', bg: 'from-red-500/20 dark:from-red-400/30', primaryAttr: 'SHO' },
};

const getStatColorClasses = (value: number): { text: string; border: string; bg: string } => {
    // Sistema de colores FIFA: Bronze (0-64), Silver (65-74), Gold (75-99)
    if (value >= 75) {
        // Gold
        return {
            text: 'text-yellow-600 dark:text-yellow-400',
            border: 'border-yellow-600 dark:border-yellow-400',
            bg: 'bg-yellow-600/10'
        };
    }
    if (value >= 65) {
        // Silver
        return {
            text: 'text-slate-400 dark:text-slate-300',
            border: 'border-slate-400 dark:border-slate-300',
            bg: 'bg-slate-400/10'
        };
    }
    // Bronze (0-64)
    return {
        text: 'text-amber-700 dark:text-amber-600',
        border: 'border-amber-700 dark:border-amber-600',
        bg: 'bg-amber-700/10'
    };
};

const StatPill = ({ label, value, isPrimary, index }: { label: string; value: number; isPrimary: boolean; index: number }) => {
    const { text, border, bg } = getStatColorClasses(value);

    return (
        <motion.div
            className={cn(
                "relative flex items-center justify-between rounded-lg p-2 text-xs font-bold border-2",
                "transition-all duration-200",
                border,
                bg,
                // Atributo máximo: brillo que recorre el borde + estrella
                isPrimary && 'stat-border-glow stat-sparkle',
                // Hover solo para atributos no primarios
                !isPrimary && "hover:scale-105 hover:shadow-lg hover:z-10"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
            whileHover={!isPrimary ? { scale: 1.05, transition: { duration: 0.2 } } : undefined}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className={cn("font-black", text)}>
                {value}
            </span>
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
  
  const specialty = React.useMemo(() => {
    const spec = playerSpecialties[primaryStat.key];
    if (primaryStat.value >= spec.threshold) {
      return spec;
    }
    return null;
  }, [primaryStat]);


  const CardContentComponent = () => (
    <Card
      className={cn(
        "overflow-hidden border-2 shadow-lg h-full flex flex-col group",
        "transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30",
        "active:scale-[0.98] active:shadow-md",
        "border-border"
      )}
      role="article"
      aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
    >
      <CardHeader className={cn(
        "relative p-3 sm:p-4 text-card-foreground bg-gradient-to-br to-transparent",
        positionStyles[player.position].bg
      )}>
        <div className="flex justify-between items-start">
          <motion.div
            key={player.ovr}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, type: 'spring' }}
            className={cn(
              "font-black leading-none text-4xl sm:text-5xl lg:text-6xl drop-shadow-2xl",
              player.ovr >= 85 ? "text-glow" : positionStyles[player.position].color
            )}
          >
            {player.ovr}
          </motion.div>
          <Badge
            variant="outline"
            className={cn(
              "text-sm font-bold px-2.5 py-1",
              "bg-background/90 backdrop-blur-sm",
              "border-2 shadow-md",
              positionStyles[player.position].color
            )}
            title={positionStyles[player.position].name}
          >
            {player.position}
          </Badge>
        </div>
        <div className="relative h-20 -mt-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Avatar className={cn(
              "h-20 w-20 sm:h-24 sm:w-24 overflow-hidden",
              "border-2 sm:border-4 border-background shadow-2xl",
              "transition-all duration-300",
              "group-hover:scale-110 group-hover:shadow-primary/50",
              specialty && "ring-4 ring-primary/30 ring-offset-2 ring-offset-background",
              player.ovr >= 85 && "shadow-primary/40"
            )}>
              <AvatarImage
                src={player.photoUrl}
                alt={playerName}
                data-ai-hint="player portrait"
                className="group-hover:brightness-110 transition-all duration-300"
                style={{
                  objectFit: 'cover',
                  objectPosition: `${player.cropPosition?.x || 50}% ${player.cropPosition?.y || 50}%`,
                  transform: `scale(${player.cropZoom || 1})`,
                  transformOrigin: 'center center',
                }}
              />
              <AvatarFallback className="text-4xl font-black">
                {playerName.charAt(0)}
              </AvatarFallback>
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
        <div className="mt-4 pt-2 text-center">
            <h3 className="text-lg font-bold font-headline truncate">{playerName}</h3>
            {specialty && (
                <motion.div
                  className="flex items-center justify-center gap-2 mt-2 px-3 py-1.5 mx-auto max-w-fit bg-primary/10 rounded-full border border-primary/30"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                >
                  <specialty.icon className="h-5 w-5 text-primary animate-pulse" />
                  <span className="text-base font-bold text-primary text-glow">{specialty.nickname}</span>
                </motion.div>
            )}
            {isManualPlayer && !specialty && (
              <Badge variant="outline" className="mt-1 text-xs border-dashed">
                Manual
              </Badge>
            )}
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-4 text-center bg-card flex-grow flex flex-col justify-center">
         <div className="grid grid-cols-2 gap-2 sm:gap-3 my-3 sm:my-4">
            {stats.map((stat, index) => (
                <StatPill
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    isPrimary={stat.key === primaryStat.key}
                    index={index}
                />
            ))}
        </div>
        <div className="mt-auto pt-4 sm:pt-5 border-t">
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
