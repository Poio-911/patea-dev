
'use client';

import React from 'react';
import { useUser } from '@/firebase';
import type { Player } from '@/lib/types';
import { PlayerCard } from '@/components/player-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { PlayerRecentActivity } from './player-recent-activity';

type PlayerProfileViewProps = {
  playerId: string;
  player: Player;
};

export default function PlayerProfileView({ playerId, player }: PlayerProfileViewProps) {
  const { user } = useUser();
  const isCurrentUserProfile = user?.uid === playerId;

  return (
    <div className="flex flex-col gap-8">
      {/* Usamos la PlayerCard existente que ya es responsive y visualmente atractiva */}
      <PlayerCard player={player} />
      
      {isCurrentUserProfile && (
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
      )}

      {/* Componente para la actividad reciente */}
      <PlayerRecentActivity playerId={playerId} />

    </div>
  );
}
