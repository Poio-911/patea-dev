'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import type { Invitation } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/navigation/back-button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InvitationCard, RespondedInvitationCard } from '@/components/invitations/invitation-card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { acceptPlayerMatchInvitationAction, rejectPlayerMatchInvitationAction } from '@/lib/actions/match-invitation-actions';

export default function InvitationsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [respondedOpen, setRespondedOpen] = useState(false);

  // Query for pending invitations
  const pendingQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'invitations'),
      where('playerId', '==', user.uid),
      where('status', '==', 'pending')
    );
  }, [firestore, user?.uid]);

  // Query for responded invitations (accepted or declined)
  const respondedQuery = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collectionGroup(firestore, 'invitations'),
      where('playerId', '==', user.uid),
      where('status', 'in', ['accepted', 'declined'])
    );
  }, [firestore, user?.uid]);

  const { data: pendingInvitations, loading: pendingLoading } = useCollection<Invitation>(pendingQuery);
  const { data: respondedInvitations, loading: respondedLoading } = useCollection<Invitation>(respondedQuery);

  const handleAccept = async (invitation: Invitation) => {
    if (!user) return;
    setProcessingId(invitation.id);

    const matchId = invitation.matchId;
    if (!matchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'ID de partido no válido.' });
      setProcessingId(null);
      return;
    }
    try {
      const result = await acceptPlayerMatchInvitationAction(matchId, invitation.id);
      if (!result.success) {
        throw new Error(result.error || 'No se pudo aceptar la invitación.');
      }

      toast({
        title: 'Te uniste al partido',
        description: 'Te has sumado al partido.'
      });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `matches/${matchId}/invitations/${invitation.id}`,
        operation: 'update',
        requestResourceData: { status: 'accepted' }
      }));
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo aceptar la invitación.'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!user) return;
    setProcessingId(invitation.id);

    const matchId = invitation.matchId;
    if (!matchId) {
      toast({ variant: 'destructive', title: 'Error', description: 'ID de partido no válido.' });
      setProcessingId(null);
      return;
    }
    try {
      const result = await rejectPlayerMatchInvitationAction(matchId, invitation.id);
      if (!result.success) {
        throw new Error(result.error || 'No se pudo rechazar la invitación.');
      }
      toast({
        title: 'Invitación rechazada',
        description: 'Has rechazado la invitación al partido.'
      });
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `matches/${matchId}/invitations/${invitation.id}`,
        operation: 'update',
        requestResourceData: { status: 'declined' }
      }));
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo rechazar la invitación.'
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (userLoading || pendingLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackButton href="/dashboard" label="Volver al Inicio" className="self-start" />
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Alert>
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>Debes iniciar sesión para ver tus invitaciones.</AlertDescription>
      </Alert>
    );
  }

  const pendingCount = pendingInvitations?.length || 0;
  const respondedCount = respondedInvitations?.length || 0;

  return (
    <div className="flex flex-col gap-4">
      <BackButton href="/dashboard" label="Volver al Inicio" className="self-start" />
      <PageHeader
        title="Invitaciones"
        description={
          pendingCount > 0
            ? `Tenés ${pendingCount} ${pendingCount === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}`
            : 'Acá aparecen las invitaciones a partidos que recibís'
        }
      />

      {/* Pending Invitations */}
      {pendingCount > 0 ? (
        <div className="space-y-3">
          {pendingInvitations?.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onAccept={handleAccept}
              onReject={handleReject}
              isProcessing={processingId === invitation.id}
            />
          ))}
        </div>
      ) : (
        <Alert className="text-center py-8">
          <Mail className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
          <AlertTitle>Sin invitaciones pendientes</AlertTitle>
          <AlertDescription>
            Cuando un organizador te invite a un partido, aparecerá acá.
          </AlertDescription>
        </Alert>
      )}

      {/* Responded Invitations */}
      {respondedCount > 0 && (
        <Collapsible open={respondedOpen} onOpenChange={setRespondedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span>Invitaciones respondidas ({respondedCount})</span>
              {respondedOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {respondedInvitations?.map((invitation) => (
              <RespondedInvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
