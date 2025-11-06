'use client';

import { useParams } from 'next/navigation';
import PlayerProfileView from '@/components/player-profile-view';
import { useDoc, useFirestore } from '@/firebase';
import type { Player } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function PlayerDetailPage() {
  const { id: playerId } = useParams();
  const firestore = useFirestore();

  const playerRef = useMemo(() => {
    if (!firestore || !playerId) return null;
    return doc(firestore, 'players', playerId as string);
  }, [firestore, playerId]);
  
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  if (playerLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!playerId || typeof playerId !== 'string') {
    return <div>ID de jugador no válido.</div>;
  }

  if (!player) {
    return (
        <div className="text-center p-8">
            <h2 className="text-xl font-bold mb-4">Jugador no encontrado</h2>
            <Button asChild variant="outline">
                <Link href="/players">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver al Plantel
                </Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
            title={player.name}
            description="Perfil y estadísticas del jugador."
        />
        <Button asChild variant="outline" className="self-start sm:self-center">
          <Link href="/players">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Plantel
          </Link>
        </Button>
      </div>
      <PlayerProfileView playerId={playerId} player={player} />
    </div>
  );
}
