'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Player } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { PlayerMatchDebriefView } from '@/components/player-match-debrief-view';

export default function HistorialPage() {
  const params = useParams<{ id: string }>();
  const playerId = params?.id;
  const firestore = useFirestore();

  const playerRef = firestore && playerId ? doc(firestore, 'players', playerId as string) : null;
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  if (playerLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!player) {
    return <div className="text-center">Jugador no encontrado.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-full items-center justify-between">
        <Button asChild variant="outline" className="self-start">
          <Link href={`/players/${playerId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Perfil
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Historial de Partidos"
        description={`Evaluaciones, goles y evolución de atributos de ${player.name}.`}
      />
      <Separator />

      <PlayerMatchDebriefView playerId={playerId as string} />
    </div>
  );
}
