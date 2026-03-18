'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collectionGroup, query, where, doc, getDoc } from 'firebase/firestore';
import type { Invitation, Match } from '@/lib/types';
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
import { acceptPlayerMatchInvitationAction, rejectPlayerMatchInvitationAction } from '@/lib/actions/match-invitation-actions';

interface InvitationCardProps {
  invitation: Invitation;
  onAction: (invitation: Invitation, accepted: boolean) => void;
  isProcessing: boolean;
}

function InvitationCard({ invitation, onAction, isProcessing }: InvitationCardProps) {
  const firestore = useFirestore();
  const [matchInfo, setMatchInfo] = useState<{ title: string; date: string | null }>({
    title: 'Cargando...',
    date: null,
  });
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  useEffect(() => {
    const fetchMatchInfo = async () => {
      if (invitation.matchId && firestore) {
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
          console.error("Error fetching match info:", error);
          setMatchInfo({ title: 'Error al cargar partido', date: null });
        } finally {
          setIsLoadingInfo(false);
        }
      }
    };

    fetchMatchInfo();
  }, [invitation.matchId, firestore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isLoadingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : matchInfo.title}</CardTitle>
        <CardDescription>
          {matchInfo.date ? format(new Date(matchInfo.date), "EEEE, d 'de' MMMM, yyyy", { locale: es }) : "Fecha no disponible"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-end gap-2">
        <Button size="sm" variant="destructive" onClick={() => onAction(invitation, false)} disabled={isProcessing}>
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          <span className="ml-2">Rechazar</span>
        </Button>
        <Button size="sm" variant="default" onClick={() => onAction(invitation, true)} disabled={isProcessing}>
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
    if (!user) return;
    setProcessingId(invitation.id);

    const matchId = invitation.matchId;
    if (!matchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'ID de partido no válido en la invitación.' });
      setProcessingId(null);
      return;
    }

    try {
      const result = accepted
        ? await acceptPlayerMatchInvitationAction(matchId, invitation.id)
        : await rejectPlayerMatchInvitationAction(matchId, invitation.id);

      if (!result.success) {
        throw new Error(result.error || 'No se pudo procesar la invitación.');
      }

      if (accepted) {
        toast({ title: '¡Aceptada!', description: `Te has unido al partido.` });
      } else {
        toast({ title: 'Rechazada', description: 'Has rechazado la invitación.' });
      }

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
