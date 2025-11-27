'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, HelpCircle, Clock, Loader2 } from 'lucide-react';
import { respondToMatchInvitationAction } from '@/lib/actions/match-invitation-actions';
import { useToast } from '@/hooks/use-toast';
import type { MatchInvitationResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

type MatchInvitationCardProps = {
  matchId: string;
  matchTitle: string;
  matchDate: string;
  matchTime: string;
  matchLocation: string;
  currentResponse?: MatchInvitationResponse;
  confirmationDeadline?: string;
  onResponseChange?: (newResponse: MatchInvitationResponse) => void;
};

const responseConfig = {
  confirmed: {
    label: 'Confirmado',
    icon: CheckCircle2,
    color: 'bg-green-500 hover:bg-green-600',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  declined: {
    label: 'No voy',
    icon: XCircle,
    color: 'bg-red-500 hover:bg-red-600',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  maybe: {
    label: 'Tal vez',
    icon: HelpCircle,
    color: 'bg-amber-500 hover:bg-amber-600',
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  pending: {
    label: 'Sin responder',
    icon: Clock,
    color: 'bg-muted hover:bg-muted/80',
    textColor: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
  },
};

export function MatchInvitationCard({
  matchId,
  matchTitle,
  matchDate,
  matchTime,
  matchLocation,
  currentResponse = 'pending',
  confirmationDeadline,
  onResponseChange,
}: MatchInvitationCardProps) {
  const { toast } = useToast();
  const [response, setResponse] = useState<MatchInvitationResponse>(currentResponse);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleResponseChange = async (newResponse: MatchInvitationResponse) => {
    if (newResponse === response || isUpdating) return;

    setIsUpdating(true);
    try {
      const result = await respondToMatchInvitationAction(matchId, newResponse);

      if (result.success) {
        setResponse(newResponse);
        if (onResponseChange) {
          onResponseChange(newResponse);
        }

        const config = responseConfig[newResponse];
        toast({
          title: 'Respuesta actualizada',
          description: `Tu respuesta fue cambiada a "${config.label}"`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'No se pudo actualizar tu respuesta',
        });
      }
    } catch (error: any) {
      console.error('Error updating match response:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ocurrió un error al actualizar tu respuesta',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const currentConfig = responseConfig[response];
  const CurrentIcon = currentConfig.icon;

  // Verificar si pasó el deadline
  const isPastDeadline = confirmationDeadline
    ? new Date(confirmationDeadline) < new Date()
    : false;

  return (
    <Card className={cn('relative overflow-hidden', currentConfig.bgColor)}>
      {/* Badge de estado actual */}
      <div className="absolute top-3 right-3">
        <Badge
          variant="secondary"
          className={cn(
            'flex items-center gap-1 font-semibold',
            currentConfig.textColor
          )}
        >
          <CurrentIcon className="w-3 h-3" />
          {currentConfig.label}
        </Badge>
      </div>

      <CardHeader>
        <CardTitle className="text-xl pr-32">{matchTitle}</CardTitle>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-semibold">
            {matchDate} - {matchTime}
          </p>
          <p>{matchLocation}</p>
          {confirmationDeadline && !isPastDeadline && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Confirmar antes del {new Date(confirmationDeadline).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
          {isPastDeadline && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Plazo de confirmación vencido
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium">¿Vas a asistir?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={response === 'confirmed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleResponseChange('confirmed')}
              disabled={isUpdating || isPastDeadline}
              className={cn(
                response === 'confirmed' && 'bg-green-500 hover:bg-green-600'
              )}
            >
              {isUpdating && response === 'confirmed' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-1" />
              )}
              Sí
            </Button>

            <Button
              variant={response === 'maybe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleResponseChange('maybe')}
              disabled={isUpdating || isPastDeadline}
              className={cn(
                response === 'maybe' && 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              {isUpdating && response === 'maybe' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <HelpCircle className="w-4 h-4 mr-1" />
              )}
              Tal vez
            </Button>

            <Button
              variant={response === 'declined' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleResponseChange('declined')}
              disabled={isUpdating || isPastDeadline}
              className={cn(
                response === 'declined' && 'bg-red-500 hover:bg-red-600'
              )}
            >
              {isUpdating && response === 'declined' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-1" />
              )}
              No
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
