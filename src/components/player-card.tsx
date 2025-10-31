
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
  DEL: 'bg-chart-1/10',
  MED: 'bg-chart-2/10',
  DEF: 'bg-chart-3/10',
  POR: 'bg-chart-4/10',
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

const Stat = ({ label, value, isBest }: { label: string; value: number, isBest: boolean }) => {
  const Icon = statIcons[label] || Zap;
  return (
    <div className="flex flex-col gap-1 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground/80 group-hover:text-primary transition-colors" />
          <span className="font-semibold text-muted-foreground text-xs">{label}</span>
        </div>
        <span className={cn("font-bold text-sm", isBest && "text-primary")}>{value}</span>
      </div>
      <motion.div whileHover={{ scaleX: 1.05, transition: { duration: 0.2 } }}>
        <Progress value={value} isBest={isBest} />
      </motion.div>
    </div>
  );
};

export function PlayerCard({ player, isLink = true }: PlayerCardProps) {
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
  
  const stats: { label: 'RIT' | 'TIR' | 'PAS' | 'REG' | 'DEF' | 'FIS', value: number }[] = [
    { label: 'RIT', value: player.pac },
    { label: 'TIR', value: player.sho },
    { label: 'PAS', value: player.pas },
    { label: 'REG', value: player.dri },
    { label: 'DEF', value: player.def },
    { label: 'FIS', value: player.phy },
  ];
  
  const maxStatValue = Math.max(...stats.map(s => s.value));

  const CardContentComponent = () => (
    <Card className="overflow-hidden border-2 shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 border-border h-full flex flex-col group">
      <CardHeader className={cn(
        "relative p-3 text-card-foreground bg-gradient-to-br from-transparent",
        positionBackgrounds[player.position]
      )}>
        <div className="flex items-start justify-between">
          <div className="relative">
            <div className={cn("text-3xl font-bold leading-none", positionColors[player.position])}>
              {player.ovr}
            </div>
          </div>
          <Badge variant="secondary" className={cn("mt-1 text-xs", positionColors[player.position])}>
            {player.position}
          </Badge>
          {(canEdit || canDelete) && (
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:bg-white/20">
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
      </CardHeader>

      <CardContent className="p-3 text-center bg-card flex-grow flex flex-col">
        <Avatar className="mx-auto -mt-10 h-20 w-20 border-4 border-background overflow-hidden">
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
          <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="mt-2 text-center">
          <h3 className="text-lg font-bold font-headline truncate">{playerName}</h3>
          {isManualPlayer && (
            <Badge variant="outline" className="mt-1 text-xs border-dashed">
              Manual
            </Badge>
          )}
        </div>

        <div className="mt-4 space-y-2.5 flex-grow">
          {stats.map((stat) => (
            <Stat key={stat.label} label={stat.label} value={stat.value} isBest={stat.value === maxStatValue} />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  if (isLink) {
    return (
        <Link href={`/players/${player.id}`} className="block h-full">
            <CardContentComponent />
        </Link>
    );
  }

  return <CardContentComponent />;
}
