'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DollarSign, Users, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { getMatchInvitationsAction } from '@/lib/actions/match-invitation-actions';
import { db } from '@/firebase';
import type { Match, MatchInvitation } from '@/lib/types';
import { cn } from '@/lib/utils';

type MatchCostSplitProps = {
  match: Match;
};

type PlayerPaymentInfo = {
  userId: string;
  name: string;
  photoUrl?: string;
  amountToPay: number;
  hasPaid: boolean;
};

export function MatchCostSplit({ match }: MatchCostSplitProps) {
  const [players, setPlayers] = useState<PlayerPaymentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPaymentInfo();
  }, [match.id]);

  const loadPaymentInfo = async () => {
    try {
      if (!match.cost?.splitBetweenPlayers) {
        setIsLoading(false);
        return;
      }

      // Obtener invitaciones confirmadas
      const result = await getMatchInvitationsAction(match.id);
      if (!result.success || !result.invitations) {
        setIsLoading(false);
        return;
      }

      const confirmedInvitations = result.invitations.filter(
        (inv) => inv.response === 'confirmed'
      );

      // Calcular monto por jugador
      const totalConfirmed = confirmedInvitations.length;
      const perPlayerAmount = totalConfirmed > 0
        ? match.cost.total / totalConfirmed
        : 0;

      // Cargar info de jugadores
      const playersData: PlayerPaymentInfo[] = [];

      for (const invitation of confirmedInvitations) {
        const playerDoc = await db.collection('players').doc(invitation.userId).get();
        const playerData = playerDoc.data();

        playersData.push({
          userId: invitation.userId,
          name: playerData?.name || 'Jugador',
          photoUrl: playerData?.photoUrl,
          amountToPay: perPlayerAmount,
          hasPaid: false, // TODO: Implementar sistema de pagos
        });
      }

      setPlayers(playersData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading payment info:', error);
      setIsLoading(false);
    }
  };

  // Si no hay info de costo, no mostrar nada
  if (!match.cost) {
    return null;
  }

  const { total, currency, splitBetweenPlayers, perPlayerAmount } = match.cost;

  // Si no se divide, solo mostrar el costo total
  if (!splitBetweenPlayers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5" />
            Costo del Partido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <span className="text-muted-foreground">Costo total:</span>
            <span className="text-2xl font-bold">
              {currency} ${total.toLocaleString('es-AR')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            El costo no se divide entre jugadores
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calcular estadísticas
  const totalPaid = players.filter((p) => p.hasPaid).length;
  const totalPending = players.length - totalPaid;
  const amountCollected = totalPaid * (perPlayerAmount || 0);
  const amountPending = totalPending * (perPlayerAmount || 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="w-5 h-5" />
          Split de Costos
        </CardTitle>
        <CardDescription>
          Dividido entre {players.length} jugadores confirmados
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Costo Total</p>
            <p className="text-xl font-bold">
              {currency} ${total.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Por Jugador</p>
            <p className="text-xl font-bold text-primary">
              {currency} ${(perPlayerAmount || 0).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {/* Progreso de pagos */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className="font-medium">
              {totalPaid} / {players.length} pagaron
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${players.length > 0 ? (totalPaid / players.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recaudado: {currency} ${amountCollected.toFixed(2)}</span>
            <span>Falta: {currency} ${amountPending.toFixed(2)}</span>
          </div>
        </div>

        {/* Lista de jugadores */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Jugadores ({players.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {players.map((player) => (
              <div
                key={player.userId}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  player.hasPaid
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                    : 'bg-card'
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={player.photoUrl} alt={player.name} />
                    <AvatarFallback>
                      {player.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {currency} ${player.amountToPay.toFixed(2)}
                    </p>
                  </div>
                </div>

                {player.hasPaid ? (
                  <Badge className="bg-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Pagado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    Pendiente
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Nota */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            💡 El sistema de pagos se habilitará próximamente
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
