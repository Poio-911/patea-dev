'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, HelpCircle, Clock, Users } from 'lucide-react';
import { getMatchInvitationsAction } from '@/lib/actions/match-invitation-actions';
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import type { MatchInvitation, MatchInvitationResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

type MatchAttendeesListProps = {
  matchId: string;
  showTitle?: boolean;
};

type PlayerInfo = {
  id: string;
  name: string;
  photoUrl?: string;
  response: MatchInvitationResponse;
  respondedAt?: string;
};

const responseConfig = {
  confirmed: {
    label: 'Confirmado',
    icon: CheckCircle2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
  },
  declined: {
    label: 'No va',
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
  maybe: {
    label: 'Tal vez',
    icon: HelpCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
  pending: {
    label: 'Sin responder',
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
  },
};

export function MatchAttendeesList({
  matchId,
  showTitle = true,
}: MatchAttendeesListProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const loadPlayers = async () => {
      try {
        // Cargar invitaciones
        const result = await getMatchInvitationsAction(matchId);

        if (!result.success || !result.invitations) {
          setIsLoading(false);
          return;
        }

        const invitations = result.invitations;

        // Cargar información de los jugadores desde Firestore
        const playerPromises = invitations.map(async (invitation) => {
          const playerDoc = await getDoc(doc(db, 'players', invitation.userId));
          const playerData = playerDoc.data();

          return {
            id: invitation.userId,
            name: playerData?.name || 'Jugador',
            photoUrl: playerData?.photoUrl,
            response: invitation.response,
            respondedAt: invitation.respondedAt,
          };
        });

        const playersData = await Promise.all(playerPromises);
        setPlayers(playersData);

        // Suscribirse a cambios en tiempo real
        unsubscribe = onSnapshot(
          collection(db, 'matches', matchId, 'invitations'),
          async (snapshot) => {
            const updatedInvitations: MatchInvitation[] = snapshot.docs.map(doc => ({
              ...doc.data(),
              id: doc.id,
            })) as MatchInvitation[];

            // Recargar información de jugadores
            const updatedPlayerPromises = updatedInvitations.map(async (invitation) => {
              const playerDoc = await db.collection('players').doc(invitation.userId).get();
              const playerData = playerDoc.data();

              return {
                id: invitation.userId,
                name: playerData?.name || 'Jugador',
                photoUrl: playerData?.photoUrl,
                response: invitation.response,
                respondedAt: invitation.respondedAt,
              };
            });

            const updatedPlayers = await Promise.all(updatedPlayerPromises);
            setPlayers(updatedPlayers);
          }
        );

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading match attendees:', error);
        setIsLoading(false);
      }
    };

    loadPlayers();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [matchId]);

  // Agrupar por respuesta
  const confirmed = players.filter(p => p.response === 'confirmed');
  const maybe = players.filter(p => p.response === 'maybe');
  const declined = players.filter(p => p.response === 'declined');
  const pending = players.filter(p => p.response === 'pending');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Cargando asistencias...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Asistencia ({confirmed.length}/{players.length})
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {/* Confirmados */}
        {confirmed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <h4 className="font-semibold text-sm">Confirmados ({confirmed.length})</h4>
            </div>
            <div className="space-y-2">
              {confirmed.map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
            </div>
          </div>
        )}

        {/* Tal vez */}
        {maybe.length > 0 && (
          <>
            {confirmed.length > 0 && <Separator />}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <h4 className="font-semibold text-sm">Tal vez ({maybe.length})</h4>
              </div>
              <div className="space-y-2">
                {maybe.map(player => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sin responder */}
        {pending.length > 0 && (
          <>
            {(confirmed.length > 0 || maybe.length > 0) && <Separator />}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Sin responder ({pending.length})</h4>
              </div>
              <div className="space-y-2">
                {pending.map(player => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Rechazados */}
        {declined.length > 0 && (
          <>
            {(confirmed.length > 0 || maybe.length > 0 || pending.length > 0) && <Separator />}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <h4 className="font-semibold text-sm">No van ({declined.length})</h4>
              </div>
              <div className="space-y-2">
                {declined.map(player => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            </div>
          </>
        )}

        {players.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay jugadores invitados aún</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlayerRow({ player }: { player: PlayerInfo }) {
  const config = responseConfig[player.response];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={player.photoUrl} alt={player.name} />
          <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">{player.name}</p>
          {player.respondedAt && (
            <p className="text-xs text-muted-foreground">
              {new Date(player.respondedAt).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
      <Badge variant="secondary" className={cn('flex items-center gap-1', config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    </div>
  );
}
