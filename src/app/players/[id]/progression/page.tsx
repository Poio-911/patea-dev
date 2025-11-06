
'use client';

import { useParams } from 'next/navigation';
import { useDoc, useUser, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Player } from '@/lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { PlayerProgressionView } from '@/components/player-progression-view';

export default function ProgressionPage() {
  const { id: playerId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const playerRef = firestore && playerId ? doc(firestore, 'players', playerId as string) : null;
  const { data: player, loading: playerLoading } = useDoc<Player>(playerRef);

  if (playerLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
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
            title="Progresión del Jugador"
            description={`Analizá la evolución de ${player.name} a lo largo del tiempo.`}
        />
        <Separator />
      
        <PlayerProgressionView playerId={playerId as string} />
    </div>
  );
}
