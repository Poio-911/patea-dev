
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WandSparkles, MoreVertical, Trash2, Pencil, Eye } from 'lucide-react';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { EditPlayerDialog } from './edit-player-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFirestore, useUser } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import React from 'react';
import { Badge } from './ui/badge';
import { AttributeKey } from '@/lib/data';

type PlayerCardProps = {
  player: Player & { displayName?: string }; // Allow displayName for compatibility
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

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center justify-center rounded-lg bg-muted/50 p-2 text-center">
    <span className="text-xl font-bold">{value}</span>
    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
  </div>
);

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
  }

  const CardContentComponent = () => (
    <Card className="overflow-hidden border-2 shadow-lg transition-transform hover:scale-105 hover:shadow-xl border-border h-full flex flex-col">
       <div className={cn("relative p-4 text-card-foreground", positionBackgrounds[player.position])}>
            <div className="flex items-start justify-between">
                <div>
                    <div className={cn("text-3xl font-bold leading-none", positionColors[player.position])}>{player.ovr}</div>
                </div>

                {(canEdit || canDelete) && (
                     <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-white/20">
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

      <CardContent className="p-4 text-center bg-card flex-grow flex flex-col">
        <Dialog>
          <DialogTrigger asChild>
            <button className="mx-auto -mt-12 group relative">
              <Avatar className="h-24 w-24 border-4 border-background group-hover:scale-105 group-hover:ring-4 group-hover:ring-primary transition-all duration-200">
                <AvatarImage src={player.photoUrl} alt={playerName} data-ai-hint="player portrait" />
                <AvatarFallback>{playerName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="h-8 w-8 text-white" />
              </div>
            </button>
          </DialogTrigger>
          <DialogContent className="p-0 border-0 max-w-lg">
            <img src={player.photoUrl} alt={playerName} className="w-full h-auto rounded-lg" />
          </DialogContent>
        </Dialog>
        
        <div className="mt-2 text-center">
            <h3 className="text-xl font-bold font-headline truncate">{playerName}</h3>
            <Badge variant="secondary" className={cn("mt-1", positionColors[player.position])}>{player.position}</Badge>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-2 flex-grow content-center">
          <Stat label="RIT" value={player.pac} />
          <Stat label="TIR" value={player.sho} />
          <Stat label="PAS" value={player.pas} />
          <Stat label="REG" value={player.dri} />
          <Stat label="DEF" value={player.def} />
          <Stat label="FIS" value={player.phy} />
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
