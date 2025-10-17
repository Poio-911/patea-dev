
'use client';

import { useParams } from 'next/navigation';
import { PlayerProfileView } from '@/components/player-profile-view';

export default function PlayerDetailPage() {
  const { id: playerId } = useParams();

  if (!playerId || typeof playerId !== 'string') {
    return <div>ID de jugador no válido.</div>;
  }

  return <PlayerProfileView playerId={playerId} />;
}
