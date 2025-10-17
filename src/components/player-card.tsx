import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { WandSparkles, MoreVertical, Trash2, Pencil } from 'lucide-react';
import type { Player } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AISuggestionDialog } from './ai-suggestion-dialog';
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
import { useFirestore, useUser } from '@/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import React from 'react';


type PlayerCardProps = {
  player: Player;
  isLink?: boolean;
};

const positionColors: Record<Player['position'], string> = {
  DEL: 'from-red-500 to-red-700',
  MED: 'from-green-500 to-green-700',
  DEF: 'from-blue-500 to-blue-700',
  POR: 'from-orange-500 to-orange-700',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="font-semibold text-muted-foreground">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export function PlayerCard({ player, isLink = true }: PlayerCardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isAlertOpen, setIsAlertOpen] = React.useState(false);

  // A manual player is one whose document ID is not the same as the UID of the user who created them.
  // Registered users have their player ID === their user UID.
  const isManualPlayer = player.id !== player.ownerUid;
  const canDelete = isManualPlayer && user?.uid === player.ownerUid;
  const canEdit = isManualPlayer && user?.uid === player.ownerUid;

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

  const CardContentComponent = () => (
    <Card className="overflow-hidden border-2 shadow-lg transition-transform hover:scale-105 hover:shadow-xl border-border h-full flex flex-col">
       <div className={cn("relative p-4 text-white bg-gradient-to-br", positionColors[player.position])}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col">
                    <div className="text-4xl font-bold">{player.ovr}</div>
                    <div className="text-md font-semibold">{player.position}</div>
                </div>

                {(canEdit || canDelete) && (
                     <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
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
        </div>

      <CardContent className="p-4 text-center bg-card flex-grow flex flex-col">
        <Avatar className="mx-auto -mt-16 h-24 w-24 border-4 border-background">
          <AvatarImage src={player.photoUrl} alt={player.name} data-ai-hint="player portrait" />
          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <h3 className="mt-2 text-xl font-bold font-headline truncate">{player.name}</h3>
        
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 flex-grow">
          <Stat label="RIT" value={player.pac} />
          <Stat label="TIR" value={player.sho} />
          <Stat label="PAS" value={player.pas} />
          <Stat label="REG" value={player.dri} />
          <Stat label="DEF" value={player.def} />
          <Stat label="FIS" value={player.phy} />
        </div>

        <AISuggestionDialog player={player}>
          <Button variant="outline" size="sm" className="mt-6 w-full">
            <WandSparkles className="mr-2 h-4 w-4" />
            Consejos IA
          </Button>
        </AISuggestionDialog>
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
