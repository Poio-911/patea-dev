'use client';

import React, { useState } from 'react';
import { useUser } from '@/firebase';
import type { Player, Jersey } from '@/lib/types';
import { PlayerDetailCard } from '@/components/player-detail-card';
import { LineChart, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { PlayerTeamsList } from './player-teams-list';
import { PlayerAchievementsPanel } from './player-achievements-panel';
import { PlayerMatchDebriefView } from './player-match-debrief-view';
import { useRouter } from 'next/navigation';

type PlayerProfileViewProps = {
  playerId: string;
  player: Player;
  jersey?: Jersey;
};

export default function PlayerProfileView({ playerId, player, jersey }: PlayerProfileViewProps) {
  const { user } = useUser();
  const router = useRouter();
  const [localPlayer, setLocalPlayer] = useState<Player>(player);

  const isCurrentUserProfile = user?.uid === playerId;

  const handlePhotoUpdate = (newUrl: string) => {
    // Actualizamos el estado local para reflejar el cambio en la vista enseguida
    setLocalPlayer(prev => ({ ...prev, photoUrl: newUrl }));
    router.refresh(); // Opcional, para forzar actualización en servidor si hace falta
  };

  return (
    <div className="flex flex-col gap-8">
      <PlayerDetailCard
        player={localPlayer}
        onPhotoUpdate={handlePhotoUpdate}
        isCurrentUserProfile={isCurrentUserProfile}
        jersey={jersey}
      />

      {/* NEW: Teams List */}
      <PlayerTeamsList playerId={playerId} groupId={player.groupId} />

      {isCurrentUserProfile && player.id === player.ownerUid && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href={`/players/${playerId}/analysis`}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Análisis con IA
                  </CardTitle>
                  <BrainCircuit className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Descubrí patrones y recibí consejos del DT virtual.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/players/${playerId}/progression`}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Progresión de OVR
                  </CardTitle>
                  <LineChart className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Mirá el gráfico de cómo evolucionaron tus estadísticas.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>

        </>
      )}

      {/* Historial inline — visible para cualquier perfil */}
      <PlayerMatchDebriefView playerId={playerId} compact />

      {/* NEW: Achievements Showcase - Oculto para jugadores manuales */}
      {player.id === player.ownerUid && (
        <PlayerAchievementsPanel playerId={playerId} />
      )}
    </div>
  );
}
