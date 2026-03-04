
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
import { cn } from '@/lib/utils';

interface TeamChallengeCardProps {
  invitation: Invitation;
  teamId: string;
  userId: string;
  onUpdate?: () => void;
}

export function TeamChallengeCard({ invitation, teamId, userId, onUpdate }: TeamChallengeCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isExiting, setIsExiting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleAccept = () => {
    startTransition(async () => {
      const targetTeamId = invitation.toTeamId || teamId;
      const result = await acceptTeamChallengeAction(invitation.id, targetTeamId, userId);

      if (result && 'success' in result && result.success) {
        setIsExiting(true);
        celebrationConfetti();
        toast({
          title: '¡Desafío aceptado! 🎉',
          description: `El partido contra "${invitation.fromTeamName}" ha sido creado. Próximos pasos: 1) Reservar la cancha, 2) Confirmar asistencia de jugadores, 3) Coordinar horario final.`,
          action: result.matchId ? (
            <Button
              size="sm"
              onClick={() => router.push(`/matches/${result.matchId}`)}
            >
              Ver Detalles
            </Button>
          ) : undefined,
          duration: 8000,
        });
        setTimeout(() => {
          onUpdate?.();
        }, 300);
      } else {
        toast({
          title: 'Error',
          description: (result && 'error' in result && result.error) || 'No se pudo aceptar el desafío.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const targetTeamId = invitation.toTeamId || teamId;
      const result = await rejectTeamChallengeAction(invitation.id, targetTeamId, userId);
      if (result && 'success' in result && result.success) {
        setIsExiting(true);
        toast({
          title: 'Desafío rechazado',
          description: `Has rechazado el desafío de "${invitation.fromTeamName}".`,
        });
        setTimeout(() => {
          onUpdate?.();
        }, 300);
      } else {
        toast({
          title: 'Error',
          description: (result && 'error' in result && result.error) || 'No se pudo rechazar el desafío.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Card className={cn(
      "fifa-friendly-card transition-all duration-200",
      "border-emerald-500/40 hover:shadow-lg hover:-translate-y-0.5",
      isExiting ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100 scale-100 translate-x-0'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 fifa-friendly-icon fifa-friendly-icon-animated" />
            <CardTitle className="text-base text-emerald-700 dark:text-emerald-400">Desafío Recibido</CardTitle>
          </div>
          <Badge className="fifa-friendly-badge">AMISTOSO</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Challenging Team */}
        <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-4">
          <p className="text-xs text-muted-foreground mb-3">Equipo desafiante:</p>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 flex-shrink-0">
              {invitation.fromTeamJersey && (
                <JerseyPreview jersey={invitation.fromTeamJersey} size="sm" />
              )}
            </div>
            <h4 className="font-bold text-base truncate text-emerald-700 dark:text-emerald-400">{invitation.fromTeamName}</h4>
          </div>
        </div>

        {/* Your Team */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground mb-3">Tu equipo:</p>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-12 w-12 flex-shrink-0">
              {invitation.toTeamJersey && (
                <JerseyPreview jersey={invitation.toTeamJersey} size="sm" />
              )}
            </div>
            <h4 className="font-semibold truncate">{invitation.toTeamName}</h4>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isPending}
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
            className="w-full bg-gradient-to-r from-success to-[hsl(var(--success)/0.9)] hover:from-[hsl(var(--success)/0.95)] hover:to-[hsl(var(--success)/0.85)] text-success-foreground"
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
