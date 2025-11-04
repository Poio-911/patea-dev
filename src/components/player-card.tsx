
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
import { motion } from 'framer-motion';

type PlayerCardProps = {
  player: Player & { displayName?: string };
  isLink?: boolean;
};

// Tematización avanzada por posición
const positionThemes: Record<Player['position'], {
  gradient: string;
  accent: string;
  glow: string;
  textColor: string;
}> = {
  POR: {
    gradient: 'from-yellow-500/20 via-amber-600/10 to-orange-700/20',
    accent: 'text-yellow-400',
    glow: 'shadow-yellow-500/30',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  DEF: {
    gradient: 'from-green-500/20 via-emerald-600/10 to-teal-700/20',
    accent: 'text-green-400',
    glow: 'shadow-green-500/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  MED: {
    gradient: 'from-blue-500/20 via-cyan-600/10 to-sky-700/20',
    accent: 'text-blue-400',
    glow: 'shadow-blue-500/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  DEL: {
    gradient: 'from-red-500/20 via-rose-600/10 to-pink-700/20',
    accent: 'text-red-400',
    glow: 'shadow-red-500/30',
    textColor: 'text-red-600 dark:text-red-400',
  },
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

// Sistema de brillo según OVR
const getOVRGlowClasses = (ovr: number): string => {
  if (ovr >= 90) return 'shadow-2xl shadow-yellow-500/50 ring-2 ring-yellow-500/30';
  if (ovr >= 85) return 'shadow-xl shadow-green-500/40 ring-2 ring-green-500/20';
  if (ovr >= 80) return 'shadow-lg shadow-blue-500/30 ring-1 ring-blue-500/20';
  if (ovr >= 75) return 'shadow-md shadow-purple-500/20';
  return '';
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

  const positionTheme = positionThemes[player.position];

  const CardContentComponent = () => (
    <motion.div
      whileHover={{
        y: -8,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      whileTap={{ scale: 0.98 }}
      className="h-full"
    >
      <Card
        className={cn(
          "overflow-hidden h-full flex flex-col group relative transition-all duration-300",
          "hover:border-primary/50",
          getOVRGlowClasses(player.ovr)
        )}
        role="article"
        aria-label={`Jugador ${playerName}, calificación general ${player.ovr}, posición ${player.position}`}
      >
        {/* Fondo animado con círculos blur */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className={cn(
              "absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl",
              `bg-gradient-to-br ${positionTheme.gradient}`
            )}
            animate={{
              scale: [1, 1.2, 1],
              x: [0, 20, 0],
              y: [0, 10, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          <motion.div
            className={cn(
              "absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full blur-3xl",
              `bg-gradient-to-tl ${positionTheme.gradient}`
            )}
            animate={{
              scale: [1, 1.1, 1],
              x: [0, -15, 0],
              y: [0, -10, 0],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Efecto pulse para jugadores elite (90+) */}
        {player.ovr >= 90 && (
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-yellow-400/50 pointer-events-none z-10"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.01, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        )}

        <CardHeader className="relative p-0 text-card-foreground backdrop-blur-sm bg-gradient-to-b from-background/60 to-background/40">
          <div className="absolute top-2 right-2 z-20">
            {(canEdit || canDelete) && (
              <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/80 hover:bg-black/20 hover:text-white backdrop-blur-md"
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
            {/* Glass overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-0"></div>
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] z-0"></div>

            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-white/20 mb-2 shadow-2xl z-10 relative">
                <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" />
                <AvatarFallback className="text-4xl font-black">{playerName.charAt(0)}</AvatarFallback>
              </Avatar>
            </motion.div>

            <div className="z-10">
              <h3 className="text-base sm:text-lg font-bold font-headline truncate drop-shadow-lg">{playerName}</h3>
              {isManualPlayer && <Badge variant="secondary" className="text-xs -mt-1">Manual</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative p-3 sm:p-4 text-center bg-card/80 backdrop-blur-sm flex-grow flex flex-col justify-center">
          <div className="flex items-center justify-center gap-4 mb-3">
            <motion.span
              className={cn("text-3xl sm:text-4xl font-black drop-shadow-lg", positionTheme.textColor)}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              {player.ovr}
            </motion.span>
            <Badge variant="outline" className={cn("text-sm font-bold", positionTheme.accent)}>
              {player.position}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <StatPill label={stat.label} value={stat.value} />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
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
