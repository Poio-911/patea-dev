
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collectionGroup, query, where, writeBatch, doc, getDoc, updateDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import type { Invitation, Match, Player } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

interface InvitationCardProps {
    invitation: Invitation;
    onAction: (invitation: Invitation, accepted: boolean) => void;
    isProcessing: boolean;
}

function InvitationCard({ invitation, onAction, isProcessing }: InvitationCardProps) {
    const firestore = useFirestore();
    const [matchInfo, setMatchInfo] = useState<{ title: string; date: string | null }>({
        title: invitation.matchTitle || 'Cargando...',
        date: invitation.matchDate || null,
    });
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);

    useEffect(() => {
        const fetchMatchInfoIfNeeded = async () => {
            if ((!invitation.matchTitle || !invitation.matchDate) && invitation.matchId && firestore) {
                setIsLoadingInfo(true);
                try {
                    const matchRef = doc(firestore, 'matches', invitation.matchId);
                    const matchSnap = await getDoc(matchRef);
                    if (matchSnap.exists()) {
                        const matchData = matchSnap.data() as Match;
                        setMatchInfo({
                            title: matchData.title,
                            date: matchData.date,
                        });
                    } else {
                         setMatchInfo({ title: 'Partido no encontrado', date: null });
                    }
                } catch (error) {
                    console.error("Error fetching match info for old invitation:", error);
                    setMatchInfo({ title: 'Error al cargar partido', date: null });
                } finally {
                    setIsLoadingInfo(false);
                }
            }
        };

        fetchMatchInfoIfNeeded();
    }, [invitation, firestore]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isLoadingInfo ? <Loader2 className="h-4 w-4 animate-spin"/> : matchInfo.title}</CardTitle>
                <CardDescription>
                    {matchInfo.date ? format(new Date(matchInfo.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : "Fecha no disponible"}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-end gap-2">
                <Button size="sm" variant="destructive" onClick={() => onAction(invitation, false)} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                    <span className="ml-2">Rechazar</span>
                </Button>
                <Button size="sm" variant="default" onClick={() => onAction(invitation, true)} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4" />}
                    <span className="ml-2">Aceptar</span>
                </Button>
            </CardContent>
        </Card>
    );
}

export function InvitationsSheet() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const invitationsQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'invitations'),
      where('playerId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [firestore, user?.uid]);

  const { data: invitations, loading } = useCollection<Invitation>(invitationsQuery);
  const hasInvitations = invitations && invitations.length > 0;

  const handleInvitation = async (invitation: Invitation, accepted: boolean) => {
    if (!firestore || !user) return;
    setProcessingId(invitation.id);
    
    const matchId = invitation.matchId;
    if (!matchId) {
        toast({ variant: 'destructive', title: 'Error', description: 'ID de partido no válido en la invitación.' });
        setProcessingId(null);
        return;
    }
    
    // The path to an invitation is inside its match document.
    const invitationRef = doc(firestore, 'matches', matchId, 'invitations', invitation.id);

    try {
        const batch = writeBatch(firestore);
        if (accepted) {
            const matchRef = doc(firestore, 'matches', matchId);
            const playerRef = doc(firestore, 'players', user.uid);

            const [matchSnap, playerSnap] = await Promise.all([getDoc(matchRef), getDoc(playerRef)]);
            
            if (!matchSnap.exists() || !playerSnap.exists()) {
                throw new Error("No se encontró el partido o tu perfil de jugador.");
            }

            const matchData = matchSnap.data() as Match;
            const playerData = playerSnap.data() as Player;
            
            if (matchData.players.length >= matchData.matchSize) {
                throw new Error("El partido ya está lleno.");
            }

            const playerPayload = { 
                uid: user.uid,
                displayName: playerData.name,
                ovr: playerData.ovr,
                position: playerData.position,
                photoUrl: playerData.photoUrl || ''
            };
            
            batch.update(matchRef, {
                players: arrayUnion(playerPayload),
                playerUids: arrayUnion(user.uid)
            });

            batch.update(invitationRef, { status: 'accepted' });
            toast({ title: '¡Aceptada!', description: `Te has unido al partido.` });
        } else {
             batch.update(invitationRef, { status: 'declined' });
            toast({ title: 'Rechazada', description: 'Has rechazado la invitación al partido.' });
        }
        await batch.commit();

    } catch (error: any) {
        console.error("Error handling invitation:", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo procesar la invitación.' });
    } finally {
        setProcessingId(null);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative">
          <Mail className="mr-2 h-4 w-4" />
          Invitaciones
          {hasInvitations && (
             <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Bandeja de Invitaciones</SheetTitle>
          <SheetDescription>
            Acá podés ver y responder a las invitaciones a partidos que recibiste.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : hasInvitations ? (
            <ScrollArea className="h-full pr-4">
                <div className="space-y-4 py-4">
                {invitations.map(invitation => (
                    <InvitationCard
                        key={invitation.id}
                        invitation={invitation}
                        onAction={handleInvitation}
                        isProcessing={processingId === invitation.id}
                    />
                ))}
                </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-muted-foreground">No tenés invitaciones pendientes.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
