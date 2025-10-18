
'use client';

import { useState, useMemo } from 'react';
import { useDoc, useFirestore, useUser } from '@/firebase';
import type { Match, Player, Notification } from '@/lib/types';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Users, Info, Loader2, UserPlus, LogOut, Navigation } from 'lucide-react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import Link from 'next/link';

interface MatchDetailsDialogProps {
  match: Match;
  children: React.ReactNode;
}

const statusConfig: Record<Match['status'], { label: string; className: string }> = {
    upcoming: { label: 'Próximo', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
    active: { label: 'Activo', className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
    completed: { label: 'Finalizado', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    evaluated: { label: 'Evaluado', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300' },
};

export function MatchDetailsDialog({ match: initialMatch, children }: MatchDetailsDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  const [open, setOpen] = useState(false);

  // Use useDoc to listen for real-time updates on the match
  const matchRef = useMemo(() => {
    if (!firestore || !initialMatch?.id) return null;
    return doc(firestore, 'matches', initialMatch.id);
  }, [firestore, initialMatch?.id]);

  const { data: match, loading: matchLoading } = useDoc<Match>(matchRef);

  // Use the real-time match data if available, otherwise fall back to the initial prop
  const currentMatch = match || initialMatch;

  const isUserInMatch = useMemo(() => {
    if (!user || !currentMatch?.playerUids) return false;
    return currentMatch.playerUids.includes(user.uid);
  }, [currentMatch.playerUids, user]);

  const isMatchFull = useMemo(() => {
    if (!currentMatch?.players) return true;
    return currentMatch.players.length >= currentMatch.matchSize;
  }, [currentMatch.players, currentMatch.matchSize]);

  const handleJoinOrLeaveMatch = async () => {
    if (!firestore || !user || !currentMatch) return;
    setIsJoining(true);
    
    const batch = writeBatch(firestore);
    const matchDocRef = doc(firestore, 'matches', currentMatch.id);

    try {
        if (isUserInMatch) {
            const playerToRemove = currentMatch.players.find(p => p.uid === user.uid);
            if (playerToRemove) {
                 batch.update(matchDocRef, {
                    players: arrayRemove(playerToRemove),
                    playerUids: arrayRemove(user.uid),
                });
            }
            toast({ title: 'Te has dado de baja', description: `Ya no estás apuntado a "${currentMatch.title}".` });
        } else {
            if (isMatchFull) {
                toast({ variant: 'destructive', title: 'Partido Lleno', description: 'No quedan plazas disponibles en este partido.' });
                setIsJoining(false);
                return;
            }

            const playerRef = doc(firestore, 'players', user.uid);
            const playerSnap = await getDoc(playerRef);

            if (!playerSnap.exists()) {
                 toast({ variant: 'destructive', title: 'Error', description: 'No se encontró tu perfil de jugador.' });
                 setIsJoining(false);
                 return;
            }
            const playerProfile = playerSnap.data() as Player;

             const playerPayload = {
                uid: user.uid,
                displayName: playerProfile!.name,
                ovr: playerProfile!.ovr,
                position: playerProfile!.position,
                photoUrl: playerProfile!.photoUrl || '',
              };

            batch.update(matchDocRef, {
                players: arrayUnion(playerPayload),
                playerUids: arrayUnion(user.uid),
            });
            
            if (currentMatch.ownerUid !== user.uid) {
                const notificationRef = doc(collection(firestore, `users/${currentMatch.ownerUid}/notifications`));
                const notification: Omit<Notification, 'id'> = {
                    type: 'new_joiner',
                    title: '¡Nuevo Jugador!',
                    message: `${user.displayName} se ha apuntado a tu partido "${currentMatch.title}".`,
                    link: `/matches`, // Or link to the match details page
                    isRead: false,
                    createdAt: new Date().toISOString(),
                };
                batch.set(notificationRef, notification);
            }
            
            toast({ title: '¡Te has apuntado!', description: `Estás en la lista para "${currentMatch.title}".` });
        }
        await batch.commit();
    } catch (error) {
      console.error('Error joining/leaving match: ', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la operación.' });
    } finally {
      setIsJoining(false);
    }
  };


  const statusInfo = statusConfig[currentMatch.status];
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentMatch.location.address)}&query_place_id=${currentMatch.location.placeId}`;


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{currentMatch.title}</DialogTitle>
          <DialogDescription>Detalles completos del partido.</DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto -mx-6 px-6 py-4 border-y">
            <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                    <h3 className="font-bold text-lg">{currentMatch.location.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{currentMatch.location.address}</p>
                     <Button asChild size="sm" className="mt-3">
                        <Link href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                            <Navigation className="mr-2 h-4 w-4" />
                            Ir en Google Maps
                        </Link>
                    </Button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Fecha</p>
                            <p className="font-bold">{format(new Date(currentMatch.date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Hora</p>
                            <p className="font-bold">{currentMatch.time} hs</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Users className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Plazas</p>
                            <p className="font-bold">{currentMatch.players.length} / {currentMatch.matchSize}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-3 p-3 rounded-lg border">
                        <Info className="h-5 w-5 text-muted-foreground"/>
                        <div>
                            <p className="text-sm text-muted-foreground">Estado</p>
                             <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
                        </div>
                    </div>
                </div>

                <Separator />

                <div>
                    <h3 className="font-semibold mb-3">Jugadores Apuntados</h3>
                    <ScrollArea className="h-48">
                        <div className="space-y-2 pr-4">
                            {matchLoading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-6 w-6 animate-spin"/>
                                </div>
                            ) : currentMatch.players.length > 0 ? currentMatch.players.map(player => (
                                <div key={player.uid} className="flex items-center justify-between p-2 rounded-md bg-background">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={player.photoUrl} alt={player.displayName} />
                                            <AvatarFallback>{player.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{player.displayName}</span>
                                    </div>
                                    <Badge variant="secondary">{player.ovr}</Badge>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-8">
                                    Aún no hay jugadores apuntados a este partido.
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
         <DialogFooter>
             {currentMatch.status === 'upcoming' && (currentMatch.type === 'collaborative' || currentMatch.isPublic) && user && (
                 <Button
                    variant={isUserInMatch ? 'secondary' : 'default'}
                    onClick={handleJoinOrLeaveMatch}
                    disabled={isJoining || (isMatchFull && !isUserInMatch)}
                    className="w-full"
                >
                    {isJoining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isUserInMatch ? <LogOut className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)}
                    {isMatchFull && !isUserInMatch ? "Partido Lleno" : (isUserInMatch ? 'Darse de baja' : 'Apuntarse')}
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
