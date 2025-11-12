'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Swords } from 'lucide-react';
import { Invitation } from '@/lib/types';
import { JerseyPreview } from './team-builder/jersey-preview';
import { acceptTeamChallengeAction, rejectTeamChallengeAction } from '@/lib/actions/server-actions';
import { useToast } from '@/hooks/use-toast';
import { celebrationConfetti } from '@/lib/animations';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from './ui/alert';

interface TeamChallengeCardProps {
  invitation: Invitation;
  teamId: string;
  userId: string;
  onUpdate?: () => void;
}

export function TeamChallengeCard({ invitation, teamId, userId, onUpdate }: TeamChallengeCardProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleAccept = () => {
    startTransition(async () => {
      const result = await acceptTeamChallengeAction(invitation.id, teamId, userId);
      if (result.success) {
        celebrationConfetti();
        toast({
          title: '¡Desafío aceptado!',
          description: `El partido contra "${invitation.fromTeamName}" ha sido creado.`,
          action: result.matchId ? (
            <Button
              size="sm"
              onClick={() => router.push(`/matches/${result.matchId}`)}
            >
              Ver Partido
            </Button>
          ) : undefined,
        });
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo aceptar el desafío.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectTeamChallengeAction(invitation.id, teamId, userId);
      if (result.success) {
        toast({
          title: 'Desafío rechazado',
          description: `Has rechazado el desafío de "${invitation.fromTeamName}".`,
        });
        onUpdate?.();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo rechazar el desafío.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Desafío Recibido</CardTitle>
          </div>
          <Badge variant="secondary">Nuevo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Challenging Team */}
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground mb-3">Equipo desafiante:</p>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16">
              {invitation.fromTeamJersey && (
                <JerseyPreview jersey={invitation.fromTeamJersey} size="sm" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-lg">{invitation.fromTeamName}</h4>
              <p className="text-sm text-muted-foreground">
                Quiere jugar contra tu equipo
              </p>
            </div>
          </div>
        </div>

        {/* Your Team */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Tu equipo:</p>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12">
              {invitation.fromTeamJersey && (
                <JerseyPreview jersey={invitation.fromTeamJersey} size="sm" />
              )}
            </div>
            <div>
              <h4 className="font-semibold">{invitation.toTeamName}</h4>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Rechazar
              </>
            )}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Aceptar
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface TeamChallengesListProps {
  invitations: Invitation[];
  teamId: string;
  userId: string;
  onUpdate?: () => void;
}

export function TeamChallengesList({ invitations, teamId, userId, onUpdate }: TeamChallengesListProps) {
  const pendingChallenges = invitations.filter(
    inv => inv.type === 'team_challenge' && inv.status === 'pending'
  );

  if (pendingChallenges.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No tenés desafíos pendientes en este momento.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pendingChallenges.map((invitation) => (
        <TeamChallengeCard
          key={invitation.id}
          invitation={invitation}
          teamId={teamId}
          userId={userId}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
