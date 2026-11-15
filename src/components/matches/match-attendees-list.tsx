'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, HelpCircle, Clock, Users } from 'lucide-react';
import { collection, doc, onSnapshot, getDoc, query, where } from 'firebase/firestore';
import { db, useUser } from '@/firebase';
import type { MatchInvitationResponse } from '@/lib/types';
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
    color: 'text-foreground',
    bgColor: 'bg-card/80 border border-border',
  },
  declined: {
    label: 'No va',
    icon: XCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-card/80 border border-border',
  },
  maybe: {
    label: 'Tal vez',
    icon: HelpCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-card/80 border border-border',
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
  const { user } = useUser();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setPlayers([]);
    setIsLoading(true);
    const loadPlayers = async () => {
      if (!user?.uid) { setIsLoading(false); return; }
      try {
        const match = await getDoc(doc(db, 'matches', matchId));
        if (!active) return;
        const isOwner = match.data()?.ownerUid === user.uid;
        const invitations = collection(db, 'matches', matchId, 'invitations');
        const visibleInvitations = isOwner ? invitations : query(invitations, where('playerId', '==', user.uid));
        unsubscribe = onSnapshot(visibleInvitations, async snapshot => {
          try {
            const rows = await Promise.all(snapshot.docs.map(async invitationDoc => {
              const invitation = invitationDoc.data();
              const playerId = invitation.playerId ?? invitation.userId;
              if (typeof playerId !== 'string' || !playerId) return null;
              const player = (await getDoc(doc(db, 'players', playerId))).data();
              const status = invitation.response ?? invitation.status ?? 'pending';
              const response: MatchInvitationResponse = status === 'accepted' ? 'confirmed'
                : ['confirmed', 'declined', 'maybe', 'pending'].includes(status) ? status : 'pending';
              return { id: playerId, name: player?.name || 'Jugador',
                photoUrl: player?.photoUrl ?? player?.photoURL, response,
                respondedAt: invitation.respondedAt } as PlayerInfo;
            }));
            if (active) {
              setPlayers(rows.filter((row): row is PlayerInfo => row !== null));
              setIsLoading(false);
            }
          } catch (error) {
            if (active) { setPlayers([]); setIsLoading(false); }
          }
        }, () => {
          if (active) { setPlayers([]); setIsLoading(false); }
        });
      } catch (error) {
        if (active) { setPlayers([]); setIsLoading(false); }
      }
    };
    void loadPlayers();
    return () => { active = false; unsubscribe?.(); };
  }, [matchId, user?.uid]);

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

  // No exponer estados de invitaciones ajenas a espectadores.
  if (players.length === 0) return null;

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
              <CheckCircle2 className="w-4 h-4 text-foreground" />
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
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
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
                <XCircle className="w-4 h-4 text-muted-foreground" />
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
