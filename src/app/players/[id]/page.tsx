
'use client';

import { useParams } from 'next/navigation';
import PlayerProfileView from '@/components/player-profile-view';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PlayerDetailPage() {
  const { id: playerId } = useParams();

  if (!playerId || typeof playerId !== 'string') {
    return <div>ID de jugador no válido.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
        <Button asChild variant="outline" className="self-start">
            <Link href="/players">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al Plantel
            </Link>
        </Button>
        <PlayerProfileView playerId={playerId} />
    </div>
  );
}
