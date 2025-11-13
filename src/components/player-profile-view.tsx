
'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import type { Player } from '@/lib/types';
import { PlayerDetailCard } from '@/components/player-detail-card';
import { LineChart, BrainCircuit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import Link from 'next/link';
import { PlayerRecentActivity } from './player-recent-activity';

type PlayerProfileViewProps = {
  playerId: string;
  player: Player;
};

export default function PlayerProfileView({ playerId, player: initialPlayer }: PlayerProfileViewProps) {
  const { user } = useUser();
  const [player, setPlayer] = useState<Player>(initialPlayer);
  const isCurrentUserProfile = user?.uid === playerId;

  useEffect(() => {
    setPlayer(initialPlayer);
  }, [initialPlayer]);

  const handlePhotoUpdate = (newUrl: string) => {
    setPlayer(prevPlayer => ({ ...prevPlayer, photoUrl: newUrl }));
  };

  return (
    <div className="flex flex-col gap-8">
      <PlayerDetailCard 
        player={player} 
        onPhotoUpdate={handlePhotoUpdate}
        isCurrentUserProfile={isCurrentUserProfile} 
      />
      
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

      <PlayerRecentActivity playerId={playerId} />
    </div>
  );
}
