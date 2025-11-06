'use client';

import { useUser } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import { SoccerPlayerIcon } from '@/components/icons/soccer-player-icon';
import PlayerProfileView from '@/components/player-profile-view';
import { useDoc, useFirestore } from '@/firebase';
import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import type { Player } from '@/lib/types';

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  
  const playerRef = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'players', user.uid);
  }, [firestore, user?.uid]);

  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  const loading = userLoading || playerLoading;

  if (loading) {
    return <div className="flex h-screen w-full items-center justify-center"><SoccerPlayerIcon className="h-16 w-16 color-cycle-animation" /></div>;
  }

  if (!user || !player) {
    return <div>No se encontraron datos del perfil del jugador.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
        <PageHeader
            title="Mi Perfil"
            description="Tu información personal, estadísticas de jugador y actividad."
        />
        <PlayerProfileView playerId={user.uid} player={player} />
    </div>
  );
}
