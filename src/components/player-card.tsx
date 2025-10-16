import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WandSparkles, MoreVertical, Trash2 } from 'lucide-react';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AISuggestionDialog } from './ai-suggestion-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { useFirestore, useUser } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import React from 'react';


type PlayerCardProps = {
  player: Player;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'bg-chart-1',
  MED: 'bg-chart-2',
  DEF: 'bg-chart-3',
  POR: 'bg-chart-4',
};

const positionBorderColors: Record<Player['position'], string> = {
    DEL: 'border-chart-1',
    MED: 'border-chart-2',
    DEF: 'border-chart-3',
    POR: 'border-chart-4',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export function PlayerCard({ player }: PlayerCardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);

  const isManualPlayer = player.id !== player.ownerUid;
  const canDelete = isManualPlayer && user?.uid === player.ownerUid;

  const handleDelete = async () => {
    if (!firestore || !canDelete) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'players', player.id));
        toast({
            title: "Jugador eliminado",
            description: `${player.name} ha sido eliminado de tu grupo.`
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

  return (
    <Card className={cn("overflow-hidden border-2 shadow-lg transition-transform hover:scale-105 hover:shadow-xl", positionBorderColors[player.position])}>
      <div className={cn("relative p-2 text-white", positionColors[player.position])}>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">{player.ovr}</div>
          <div className="text-sm font-semibold">{player.position}</div>
        </div>
        {canDelete && (
             <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-8 w-8 text-white hover:bg-white/20 hover:text-white">
                            <MoreVertical size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsAlertOpen(true)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Eliminar</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>¿Estás seguro de que quieres eliminar a {player.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente al jugador y sus datos.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? "Eliminando..." : "Sí, eliminar"}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>
      <CardContent className="p-4 text-center">
        <Avatar className="mx-auto -mt-10 h-20 w-20 border-4 border-card">
          <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <h3 className="mt-2 text-lg font-bold font-headline">{player.name}</h3>
        
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          <Stat label="RIT" value={player.pac} />
          <Stat label="TIR" value={player.sho} />
          <Stat label="PAS" value={player.pas} />
          <Stat label="REG" value={player.dri} />
          <Stat label="DEF" value={player.def} />
          <Stat label="FIS" value={player.phy} />
        </div>

        <AISuggestionDialog player={player}>
          <Button variant="outline" size="sm" className="mt-4 w-full">
            <WandSparkles className="mr-2 h-4 w-4" />
            Consejos IA
          </Button>
        </AISuggestionDialog>
      </CardContent>
    </Card>
  );
}
